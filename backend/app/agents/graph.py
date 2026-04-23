import json
import logging
from typing import TypedDict, Dict, Any

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.tools import parse_invoice, get_po_data_from_db, compare_po_and_invoice

# Setup
logger = logging.getLogger(__name__)
memory = MemorySaver()


# State Definition
class AgentState(TypedDict, total=False):
    """The global state object for the InvoSync matching pipeline."""
    filepath: str
    invoice_data: Dict[str, Any]
    po_data: Dict[str, Any]
    comparison_result: Dict[str, Any]
    status: str
    error_message: str
    raw_text: str
    requires_human_review: bool


# Agent Nodes
async def parse_node(state: AgentState) -> dict:
    logger.info(f"[parse_node] Parsing: {state.get('filepath')}")
    try:
        result = await parse_invoice.ainvoke({"filepath": state["filepath"]})
        data = json.loads(result)
    except Exception as e:
        logger.error(f"[parse_node] Unexpected failure: {e}", exc_info=True)
        return {
            "invoice_data": {},
            "status": "failed",
            "error_message": f"Invoice parsing crashed: {str(e)}"
        }

    raw_text = data.pop("_original_text", "")
    error_msg = ""

    if not data.get("is_invoice"):
        error_msg = data.get("reason_detail") or data.get("reason", "Not a valid invoice.")

    return {
        "invoice_data": data,
        "raw_text": raw_text,
        "status": "parsed" if data.get("is_invoice") else "failed",
        "message": "AI extraction complete" if data.get("is_invoice") else error_msg,
        "error_message": error_msg,
        "requires_human_review": data.get("requires_human_review", False)
    }


async def validate_node(state: AgentState) -> dict:
    logger.info("[validate_node] Validating invoice data...")
    data = state.get("invoice_data", {})

    if not data.get("is_invoice"):
        return {
            "status": "failed",
            "error_message": data.get("reason_detail", "Not a valid invoice document.")
        }

    po_number = str(data.get("po_number", "")).strip()
    if po_number in ["", "None", "MISSING_FIELD", "null"]:
        return {
            "status": "failed",
            "error_message": "PO number missing from invoice — cannot match to purchase order."
        }

    # Flag low confidence for human review
    confidence = float(data.get("confidence_score") or 1.0)
    if confidence < 0.5:
        logger.warning(f"[validate_node] Low confidence score: {confidence}")
        return {
            "status": "failed",
            "error_message": (
                f"Extraction confidence too low ({confidence}) — "
                f"human review required. "
                f"Low confidence fields: {data.get('low_confidence_fields', [])}"
            ),
            "requires_human_review": True
        }

    return {
        "status": "validated", 
        "message": "Invoice data verified",
        "error_message": ""
    }


async def po_lookup_node(state: AgentState) -> dict:
    po_number = state["invoice_data"].get("po_number")
    logger.info(f"[po_lookup_node] Looking up PO: {po_number}")

    try:
        result = get_po_data_from_db.invoke({"po_number": po_number})
        po_data = json.loads(result)
    except Exception as e:
        return {
            "status": "failed",
            "error_message": f"PO lookup crashed: {str(e)}"
        }

    if "error" in po_data:
        return {
            "status": "failed",
            "error_message": f"PO not found: {po_data.get('error')}"
        }

    return {
        "po_data": po_data,
        "status": "po_found",
        "message": f"Matched to PO #{po_number}",
        "error_message": ""
    }


async def compare_node(state: AgentState) -> dict:
    logger.info("[compare_node] Comparing PO and Invoice...")

    try:
        result = compare_po_and_invoice.invoke({
            "po_data_json": json.dumps(state.get("po_data", {})),
            "invoice_data_json": json.dumps(state.get("invoice_data", {}))
        })
        comparison = json.loads(result)
    except Exception as e:
        return {
            "status": "failed",
            "error_message": f"Comparison crashed: {str(e)}"
        }

    status = comparison.get("status")

    if status == "Discrepancies":
        details = comparison.get("details", [])
        error_msg = "; ".join(details) if isinstance(details, list) else str(details)
        return {
            "comparison_result": comparison,
            "status": "failed",
            "error_message": f"Discrepancies found: {error_msg}"
        }

    if status == "Error":
        return {
            "comparison_result": comparison,
            "status": "failed",
            "error_message": f"Comparison error: {comparison.get('details')}"
        }

    return {
        "comparison_result": comparison,
        "status": "completed",
        "message": "All items match PO exactly",
        "error_message": ""
    }


# Routing Logic
def should_continue(state: AgentState) -> str:
    """Checks if the invoice passed validation before attempting PO lookup."""
    return "continue" if state.get("status") == "validated" else "end"

def po_fetched_or_end(state: AgentState) -> str:
    """Checks if a PO was successfully retrieved before comparison."""
    return "continue" if state.get("status") == "po_found" else "end"


# Graph Orchestration
def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("parse", parse_node)
    graph.add_node("validate", validate_node)
    graph.add_node("po_lookup", po_lookup_node)
    graph.add_node("compare", compare_node)

    graph.add_edge(START, "parse")
    graph.add_edge("parse", "validate")

    graph.add_conditional_edges(
        "validate",
        should_continue,
        {"continue": "po_lookup", "end": END}
    )

    graph.add_conditional_edges(
        "po_lookup",
        po_fetched_or_end,
        {"continue": "compare", "end": END}
    )

    graph.add_edge("compare", END)

    return graph.compile(checkpointer=memory)


invoice_matching_app = build_graph()
