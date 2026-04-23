import os
import re
import json
import logging
from difflib import SequenceMatcher
from typing import Dict, Any

from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from llama_parse import LlamaParse
from pydantic import ValidationError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from app.core.config import settings
from app.db.session import DatabaseManager
from app.schemas.agent_schemas import InvoiceExtraction

logger = logging.getLogger(__name__)


# ── Model Init ────────────────────────────────────────────────────────────────
# Fail-safe key lookup
gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

model = ChatGoogleGenerativeAI(
    google_api_key=gemini_key,
    model="gemini-2.5-flash-lite",
    temperature=0
)

db_manager = DatabaseManager(settings.get_database_url())


# ── Helpers ───────────────────────────────────────────────────────────────────
def normalize_number(value) -> float:
    """
    Converts any value to a clean float.
    Strips currency symbols, commas, whitespace.
    Returns 0.0 for missing or invalid values.
    """
    if value is None or str(value).strip().lower() in [
        "none", "null", "", "missing_field"
    ]:
        return 0.0
    clean = re.sub(r'[^\d.-]', '', str(value).replace(',', ''))
    try:
        return float(clean) if clean else 0.0
    except (ValueError, TypeError):
        return 0.0


def numbers_match(a, b, tolerance: float = 0.10) -> bool:
    """
    Returns True if two numeric values are within tolerance of each other.
    Default tolerance is 0.10 (10 cents on dollar amounts).
    """
    return abs(normalize_number(a) - normalize_number(b)) <= tolerance


def descriptions_match(a: str, b: str, threshold: float = 0.85) -> bool:
    """
    Returns True if two strings are similar enough using fuzzy matching.
    Handles minor spelling differences, abbreviations etc.
    """
    if not a or not b:
        return False
    ratio = SequenceMatcher(
        None,
        str(a).lower().strip(),
        str(b).lower().strip()
    ).ratio()
    return ratio >= threshold


def _is_missing(value, field_type: str = "string") -> bool:
    """
    Returns True if a field value is effectively missing.
    Handles both string fields and numeric fields separately.
    """
    if value is None:
        return True
    s = str(value).strip().lower()
    if s in ["missing_field", "null", "none", "", "[]"]:
        return True
    if field_type == "number":
        try:
            return float(s) == 0.0
        except ValueError:
            return True
    return False


#  Prompt 
INVOICE_PROMPT = ChatPromptTemplate.from_template("""
You are a specialized financial document parser with expertise in accounts payable.
Your task is to extract structured data from invoice documents with maximum accuracy.

---
## STEP 1 — DOCUMENT CLASSIFICATION

Determine if this is a valid invoice.
A valid invoice MUST contain ALL of the following:
- A vendor/supplier name
- A total amount
- An invoice number
- A PO number (Purchase Order number) — this is the PRIMARY identifier
  used to match this invoice to a purchase order in our system.

If PO number is NOT found, the invoice CANNOT be processed:
{{
  "is_invoice": false,
  "reason": "insufficient_data",
  "reason_detail": "No PO number found. PO number is required to process this invoice."
}}

If NOT a valid invoice for any other reason, return ONLY:
{{
  "is_invoice": false,
  "reason": "<not_an_invoice | unreadable_document | insufficient_data | other>",
  "reason_detail": "<brief explanation>"
}}

The following are NOT invoices and must be rejected:
purchase orders, delivery notes, statements of account,
quotes, contracts, blank pages.

---
## STEP 2 — FIELD EXTRACTION RULES

### SUPPLIER — Most commonly confused field
✅ Look for: company name near logo, letterhead, "From:", "Vendor:", "Billed By:"
❌ NEVER use names from: "Bill To:", "Ship To:", "Sold To:", "Customer:", "Client:"
Rule: The supplier is OWED money. The buyer OWES money.
Example: If document says "Bill To: ABC Corp" → ABC Corp is the BUYER, not supplier.

### INVOICE NUMBER
Look for: "Invoice #", "Invoice No.", "Inv #", "Reference:", "Document No."
If multiple reference numbers exist, prefer the one explicitly labeled as invoice number.

### PO NUMBER — Primary matching identifier
Look for: "PO #", "PO Number", "Purchase Order:", "Order Ref:", "PO Ref:"
This MUST be present. If genuinely absent, reject the document as shown in STEP 1.

### AMOUNTS — Critical rules
- Return ONLY raw numbers as floats (e.g. 1500.00 not "$1,500.00")
- Remove ALL currency symbols: $, €, £, AED, USD, EUR etc.
- Remove ALL formatting commas: 1,500.00 → 1500.00

### LINE ITEMS
Extract every line item exactly as it appears on the invoice.
Do NOT calculate or derive any values.
Take quantity, unit_price, and total_price directly from the document.
Use the best available text for description — never leave it blank.

---
## STEP 3 — INTERNAL VALIDATION
Before returning, verify:
1. Sum of all line_items[total_price] + tax ≈ total_amount
2. If difference > 1.0, set amount_discrepancy to true and explain in discrepancy_detail

---
## OUTPUT RULES
Populate every field as accurately as possible.
For confidence_score:
  1.0   = all critical fields found, amounts balance, clean document
  0.7-0.9 = minor fields missing but core data solid
  0.4-0.6 = some critical fields missing or amounts do not balance
  0.0-0.3 = major extraction uncertainty, human review strongly recommended

For low_confidence_fields: list field names you were uncertain about.
Example: ["supplier", "invoice_date"]

If the document is NOT a valid invoice, set is_invoice=false and fill in the
'reason' and 'reason_detail' fields. Leave all other numeric fields as 0.0
and string fields as empty strings.

Invoice Text:
{invoice_text}
""")

# Extraction chain: uses JsonOutputParser (v1 API compatible with all gemini models)
# Pydantic validation is applied on the result immediately after — giving us schema
# enforcement, type coercion, and missing-field detection without needing v1beta.
extraction_chain = INVOICE_PROMPT | model | JsonOutputParser()


# Invoice Parsing 
@retry(
    stop=stop_after_attempt(settings.max_retries),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((ConnectionError, TimeoutError))
)
async def _parse_invoice_impl(filepath: str) -> str:
    """
    Parses an invoice document using LlamaParse and LangChain.
    Returns the extraction results as a JSON string.
    """
    if not os.path.exists(filepath):
        return json.dumps({"is_invoice": False, "reason": "File not found"})

    try:
        # 1. Extract Text from PDF (Matches Colab logic)
        parser = LlamaParse(api_key=settings.llama_cloud_api_key, language='en', result_type="markdown")
        invoice_documents = await parser.aload_data(filepath)
        
        # Unpack LlamaParse documents into a single text block
        invoice_text = "\n\n".join([doc.text for doc in invoice_documents])

        # 2. Extract Data — JsonOutputParser → Pydantic validation
        # This is the most reliable approach: parse via JsonOutputParser (v1 API,
        # works with all Gemini models), then immediately validate through the
        # InvoiceExtraction Pydantic schema for type coercion and field enforcement.
        raw_dict = await extraction_chain.ainvoke({"invoice_text": invoice_text})
        
        if not isinstance(raw_dict, dict):
            raise ValueError(f"LLM returned unexpected type: {type(raw_dict)}")

        # Validate and coerce through Pydantic schema
        try:
            extraction_obj = InvoiceExtraction.model_validate(raw_dict)
            extracted_data = extraction_obj.model_dump()
        except ValidationError as ve:
            logger.warning(f"Pydantic validation failed: {ve}. Using raw dict as fallback.")
            extracted_data = raw_dict

        # 3. Post-Process & Validate
        if extracted_data.get("is_invoice"):
            extracted_data = _validate_amounts(extracted_data)
            # Re-verify confidence based on business rules
            extracted_data = _adjust_confidence(extracted_data)

        # Attach metadata
        extracted_data["_original_text"] = str(invoice_documents)[:3000]
        extracted_data["_source_file"] = os.path.basename(filepath)

    except Exception as e:
        logger.error(f"Invoice parsing error: {e}", exc_info=True)
        return json.dumps({
            "is_invoice": False, 
            "reason": "error", 
            "reason_detail": f"Error parsing invoice with AI: {str(e)}"
        })

    logger.info(f"AI Extraction Result: {extracted_data}")

    logger.info(
        f"Parsed invoice | "
        f"file={os.path.basename(filepath)} | "
        f"is_invoice={extracted_data.get('is_invoice')} | "
        f"po_number={extracted_data.get('po_number')} | "
        f"supplier={extracted_data.get('supplier')} | "
        f"total={extracted_data.get('total_amount')} | "
        f"confidence={extracted_data.get('confidence_score')}"
    )

    return json.dumps(extracted_data)


@tool
async def parse_invoice(filepath: str) -> str:
    """
    Extracts structured fields from an invoice using LlamaParse.
    PO number is required — invoices without PO numbers are rejected.
    """
    try:
        return await _parse_invoice_impl(filepath)
    except Exception as e:
        logger.error(
            f"Fatal parse error for {filepath}: {e}",
            exc_info=True
        )
        return json.dumps({
            "is_invoice": False,
            "reason": "other",
            "reason_detail": str(e),
            "_source_file": os.path.basename(filepath) if filepath else "unknown"
        })


# Amount Validation 
def _validate_amounts(data: dict) -> dict:
    """
    Validates that extracted amounts are internally consistent.
    Checks: sum of line_items[total_price] + tax ≈ total_amount
    Never recalculates or derives any values — only flags discrepancies.
    """
    try:
        line_items = data.get("line_items", [])

        line_sum = sum(
            normalize_number(i.get("total_price"))
            for i in line_items
        )
        tax   = normalize_number(data.get("tax"))
        total = normalize_number(data.get("total_amount"))

        if total > 0 and line_sum > 0:
            expected = round(line_sum + tax, 2)
            if abs(expected - total) > 1.0:
                data["amount_discrepancy"] = True
                data["discrepancy_detail"] = (
                    f"Line items sum ({line_sum:.2f}) + "
                    f"tax ({tax:.2f}) = {expected:.2f} "
                    f"but invoice total is {total:.2f}"
                )

    except Exception as e:
        logger.warning(f"Amount validation error: {e}")

    return data


# Confidence Scoring 
def _adjust_confidence(data: dict) -> dict:
    """
    Adjusts confidence score based on missing critical and important fields.
    PO number is critical — without it the invoice cannot be matched.
    No subtotal field.
    """
    def get_missing(str_fields, num_fields):
        return [f for f in str_fields if _is_missing(data.get(f), "string")] + \
               [f for f in num_fields if _is_missing(data.get(f), "number")]

    missing_critical = get_missing(
        ["invoice_number", "supplier", "po_number"], 
        ["total_amount"]
    )

    missing_important = get_missing(
        ["invoice_date", "currency"], 
        ["tax"]
    )

    # Also penalise if line_items is empty
    if not data.get("line_items") or len(data.get("line_items", [])) == 0:
        missing_important.append("line_items")

    base    = float(data.get("confidence_score") or 1.0)
    penalty = (
        len(missing_critical)  * 0.20 +
        len(missing_important) * 0.05
    )
    data["confidence_score"] = round(max(0.0, base - penalty), 2)

    existing_low = data.get("low_confidence_fields") or []
    data["low_confidence_fields"] = list(
        set(existing_low + missing_critical)
    )

    # Flag for human review if confidence too low or any critical field missing
    data["requires_human_review"] = (
        data["confidence_score"] < 0.5 or
        bool(missing_critical)
    )

    return data


# PO Retrieval 
@tool
def get_po_data_from_db(po_number: str) -> str:
    """
    Retrieves purchase order data from the database using PO number.
    PO number is the unique identifier for matching.
    Returns full PO record including line items, amounts, and supplier.
    """
    try:
        if not po_number or not po_number.strip():
            return json.dumps({
                "error": "Invalid PO number provided — cannot be empty."
            })

        po_data = db_manager.get_po_data(po_number.strip())

        if not po_data:
            logger.warning(f"PO not found in database: {po_number}")
            return json.dumps({
                "error": (
                    f"PO number '{po_number}' not found in database. "
                    f"Verify the PO number extracted from the invoice is correct."
                )
            })

        logger.info(f"Retrieved PO from DB: {po_number}")
        return json.dumps(po_data)

    except Exception as e:
        logger.error(f"DB error retrieving PO {po_number}: {e}")
        return json.dumps({"error": f"Database error: {str(e)}"})


def check_field_match(name: str, po_val: Any, inv_val: Any, is_numeric: bool = False, tol: float = 0.10) -> str:
    """Returns a discrepancy message if values don't match or are missing on one side, else None."""
    po_empty = po_val is None or (not is_numeric and not str(po_val).strip())
    inv_empty = inv_val is None or (not is_numeric and not str(inv_val).strip())

    if not po_empty and not inv_empty:
        if is_numeric:
            if not numbers_match(po_val, inv_val, tolerance=tol):
                return f"{name} mismatch — PO: {po_val}, Invoice: {inv_val}"
        else:
            if not descriptions_match(str(po_val), str(inv_val)):
                return f"{name} mismatch — PO: '{po_val}', Invoice: '{inv_val}'"
    elif not po_empty and inv_empty:
        return f"{name} missing on Invoice but expected: {po_val}"
    elif po_empty and not inv_empty:
        return f"{name} missing in PO database but found on Invoice: {inv_val}"
    return None

@tool
def compare_po_and_invoice(po_data_json: str, invoice_data_json: str) -> str:
    """
    Compares PO data (source of truth from DB) against
    invoice data (extracted from document).
    """
    try:
        po_data      = json.loads(po_data_json)
        invoice_data = json.loads(invoice_data_json)
    except json.JSONDecodeError as e:
        return json.dumps({"status": "Error", "details": f"Invalid JSON input: {str(e)}"})

    discrepancies = []

    def _add(msg):
        if msg: discrepancies.append(msg)

    # Supplier
    _add(check_field_match("Supplier", po_data.get("supplier"), invoice_data.get("supplier")))

    # Tax — flat tolerance
    _add(check_field_match("Tax", po_data.get("tax"), invoice_data.get("tax"), is_numeric=True, tol=0.10))

    # Total Amount — relative tolerance
    po_total  = po_data.get("total_amount")
    inv_total = invoice_data.get("total_amount")
    rel_tol   = max(0.10, normalize_number(po_total) * 0.001)
    _add(check_field_match("Total Amount", po_total, inv_total, is_numeric=True, tol=rel_tol))

    # Line Items
    po_items = sorted(
        po_data.get("line_items", []),
        key=lambda x: str(x.get("description", "")).lower()
    )
    inv_items = sorted(
        invoice_data.get("line_items", []),
        key=lambda x: str(x.get("description", "")).lower()
    )

    if len(po_items) != len(inv_items):
        discrepancies.append(f"Line item count mismatch — PO has {len(po_items)}, Invoice has {len(inv_items)}")
    else:
        for i, (po_item, inv_item) in enumerate(zip(po_items, inv_items)):
            po_desc = str(po_item.get("description") or "").strip()

            _add(check_field_match(f"Line {i+1} description", po_item.get("description"), inv_item.get("description")))

            for field, tol in [("quantity", 0.01), ("unit_price", 0.10), ("total_price", 0.10)]:
                _add(check_field_match(
                    f"Line {i+1} '{po_desc}' {field.replace('_', ' ')}",
                    po_item.get(field),
                    inv_item.get(field),
                    is_numeric=True, tol=tol
                ))

    if discrepancies:
        logger.warning(f"Discrepancies found for PO {invoice_data.get('po_number')}: {len(discrepancies)} issue(s)")
        return json.dumps({"status": "Discrepancies", "details": discrepancies})

    logger.info(f"PO match successful: {invoice_data.get('po_number')}")
    return json.dumps({"status": "Successful", "details": "All fields match."})