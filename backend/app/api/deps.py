from typing import Dict, Any, Optional
from fastapi import Header, Query, HTTPException, status, Depends
from app.core.roles import UserRole, is_authorized
from app.core import security

def get_current_token_data(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """Decodes and validates the JWT from Authorization header or Query param (for SSE)."""
    jwt_token = None
    
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
    elif token:
        jwt_token = token
        
    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid Authorization: Bearer <token> or ?token=<token> required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = security.decode_token(jwt_token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials / Token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_data

def get_current_user_role(
    token_data: Dict[str, Any] = Depends(get_current_token_data)
) -> str:
    """Extracts the user role from the validated token."""
    role = token_data.get("role")
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing role information."
        )
    return role

def get_current_user_id(
    token_data: Dict[str, Any] = Depends(get_current_token_data)
) -> int:
    """Extracts the user ID from the validated token."""
    user_id = token_data.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID information."
        )
    return int(user_id)

class RoleChecker:
    """A dependency to enforce role-based access control using the validated JWT role."""
    def __init__(self, required_role: UserRole):
        self.required_role = required_role

    def __call__(self, role: str = Depends(get_current_user_role)):
        if not is_authorized(role, self.required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. This action requires at least '{self.required_role.value}' privileges."
            )
        return role
