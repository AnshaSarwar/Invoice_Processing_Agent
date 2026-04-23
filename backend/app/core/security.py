import logging
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer

import jwt
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from app.core.config import settings

# Modern hashing approach using pwdlib
password_hash = PasswordHash.recommended()

# Prevent timing attacks by hashing a dummy password for non-existent users
DUMMY_HASH = password_hash.hash("dummypassword")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and verifies a JWT token."""
    try:
        decoded = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return decoded
    except jwt.PyJWTError:
        return None

def get_password_hash(password: str) -> str:
    """Hashes a plain-text password."""
    return password_hash.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a stored hash."""
    try:
        return password_hash.verify(plain_password, hashed_password)
    except Exception:
        return False
