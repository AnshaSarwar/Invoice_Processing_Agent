from pydantic import BaseModel
from typing import Dict, Any, Optional

class LoginRequest(BaseModel):
    """Credentials for authentication."""
    username: str
    password: str

class LoginResponse(BaseModel):
    """User profile and role for the session."""
    status: str
    user: Dict[str, Any] = None
    access_token: Optional[str] = None

class SignupRequest(BaseModel):
    """Registration details."""
    username: str
    password: str
    email: Optional[str] = None
    role: str = "Operator"
