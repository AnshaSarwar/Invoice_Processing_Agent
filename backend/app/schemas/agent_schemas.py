from pydantic import BaseModel, Field
from typing import List, Optional

class ExtractionLineItem(BaseModel):
    description: str = Field(..., description="Full description of the item")
    quantity: float = Field(..., description="Number of units")
    unit_price: float = Field(..., description="Price per unit")
    total_price: float = Field(..., description="Total price for this line (quantity * unit_price)")

class InvoiceExtraction(BaseModel):
    is_invoice: bool = Field(..., description="True if the document is a valid invoice, False otherwise")
    reason: Optional[str] = Field(None, description="Reason if the document is not a valid invoice")
    reason_detail: Optional[str] = Field(None, description="Detailed explanation for rejection")
    
    invoice_number: str = Field(..., description="The unique invoice number")
    po_number: str = Field(..., description="The purchase order number associated with this invoice")
    supplier: str = Field(..., description="The name of the vendor or supplier")
    
    currency: str = Field("USD", description="Currency of the amounts")
    tax: float = Field(0.0, description="Total tax amount")
    total_amount: float = Field(..., description="Grand total amount of the invoice")
    
    line_items: List[ExtractionLineItem] = Field(default_factory=list, description="List of all items found on the invoice")
    
    confidence_score: float = Field(..., description="Extraction confidence from 0.0 to 1.0")
    low_confidence_fields: List[str] = Field(default_factory=list, description="List of fields with uncertain extraction")
    requires_human_review: bool = Field(False, description="True if human verification is recommended")
