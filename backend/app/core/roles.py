from enum import Enum

class UserRole(str, Enum):
    ADMIN = "Admin"
    OPERATOR = "Operator"

# Hierarchy definition: lower index means higher priority
ROLE_HIERARCHY = [UserRole.ADMIN, UserRole.OPERATOR]

def is_authorized(user_role: str, required_role: UserRole) -> bool:
    """Checks if a user's role meets the minimum required role level."""
    try:
        user_level = ROLE_HIERARCHY.index(UserRole(user_role))
        required_level = ROLE_HIERARCHY.index(required_role)
        return user_level <= required_level
    except (ValueError, TypeError):
        return False
