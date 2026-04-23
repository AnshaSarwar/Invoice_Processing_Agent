from pydantic import BaseModel
from typing import Optional

class ProcessingResponse(BaseModel):
    """Standard API response for invoice tasks."""
    status: str
    message: str
    task_id: Optional[str] = None
    filepath: Optional[str] = None
