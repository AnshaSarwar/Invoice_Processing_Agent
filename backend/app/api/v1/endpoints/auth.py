import logging
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import LoginRequest, LoginResponse, SignupRequest
from app.core import security
from app.db.session import DatabaseManager
from app.db.models import User

router = APIRouter()
logger = logging.getLogger(__name__)
db_manager = DatabaseManager()

def authenticate_user(username, password) -> Optional[Dict]:
    """Verify credentials against the database."""
    with db_manager.get_session() as session:
        user = session.query(User).filter_by(username=username).first()
        
        if not user:
            # Run verification against dummy hash to match response time (timing attack protection)
            security.verify_password(password, security.DUMMY_HASH)
            logger.warning(f"AUTH: Invalid username attempt: {username}")
            return None
        
        if security.verify_password(password, user.password):
            user_info = user.to_dict()
            logger.info(f"AUTH: User '{username}' authenticated successfully.")
            return user_info
        
        logger.warning(f"AUTH: Failed password attempt for user: {username}")
        return None


def signup_user(username, password, email=None, role="Operator") -> Dict:
    """Register a new user in the database."""
    with db_manager.get_session() as session:
        # Check if exists
        existing = session.query(User).filter_by(username=username).first()
        if existing:
            raise ValueError(f"Username '{username}' is already taken.")
        
        # Use modern hashing
        hashed_password = security.get_password_hash(password)
        
        new_user = User(
            username=username,
            password=hashed_password,
            email=email,
            role=role
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        logger.info(f"AUTH: New user registered: {username} ({role})")
        return new_user.to_dict()


@router.post("/login", response_model=LoginResponse)
async def login_endpoint(req: LoginRequest):
    """Verifies credentials and returns user details with a secure JWT."""
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Generate JWT
    token_data = {"sub": str(user["id"]), "role": user["role"], "username": user["username"]}
    access_token = security.create_access_token(data=token_data)
    
    return LoginResponse(status="success", user=user, access_token=access_token)


@router.post("/signup")
async def signup_endpoint(req: SignupRequest):
    """Registers a new user and returns their initial session token."""
    try:
        user = signup_user(req.username, req.password, req.email, role=req.role)
        
        # Also return token for immediate login
        token_data = {"sub": str(user["id"]), "role": user["role"], "username": user["username"]}
        access_token = security.create_access_token(data=token_data)
        
        return {"status": "success", "user": user, "access_token": access_token}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
