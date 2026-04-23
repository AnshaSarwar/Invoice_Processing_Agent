import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from app.db.session import DatabaseManager
from app.db.models import User
from app.schemas.user import UserOut, UserUpdate, UserList, UserCreate
from app.api import deps
from app.core.roles import UserRole
from app.core import security

router = APIRouter()
logger = logging.getLogger(__name__)
db_manager = DatabaseManager()


@router.get("", response_model=UserList, dependencies=[Depends(deps.RoleChecker(UserRole.ADMIN))])
async def list_users(limit: int = 100, offset: int = 0):
    """Lists all users (Admin Only)."""
    try:
        with db_manager.get_session() as session:
            query = session.query(User)
            total = query.count()
            users = query.offset(offset).limit(limit).all()
            user_list = []
            for u in users:
                d = u.to_dict()
                # Ensure the role is a string the frontend expects
                if hasattr(d['role'], 'value'):
                    d['role'] = d['role'].value
                user_list.append(d)
            return {"users": user_list, "total": total}
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(deps.RoleChecker(UserRole.ADMIN))])
async def create_user(req: UserCreate):
    """Creates a new user (Admin Only). Admin cannot assign the Admin role."""
    if req.role not in ("Operator"):
        raise HTTPException(
            status_code=400,
            detail="Admins can only create users with role 'Operator'."
        )
    with db_manager.get_session() as session:
        existing = session.query(User).filter_by(username=req.username).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Username '{req.username}' is already taken.")

        hashed_password = security.get_password_hash(req.password)
        new_user = User(
            username=req.username,
            password=hashed_password,
            email=req.email,
            role=req.role,
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        logger.info(f"USER: Admin created new user '{req.username}' with role '{req.role}'")
        return new_user.to_dict()


@router.get("/{user_id}", response_model=UserOut,
            dependencies=[Depends(deps.RoleChecker(UserRole.ADMIN))])
async def get_user(user_id: int):
    """Gets detailed info for a single user (Admin Only)."""
    with db_manager.get_session() as session:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user.to_dict()


@router.patch("/{user_id}", response_model=UserOut,
              dependencies=[Depends(deps.RoleChecker(UserRole.ADMIN))])
async def update_user(user_id: int, req: UserUpdate,
                      current_admin_id: int = Depends(deps.get_current_user_id)):
    """Updates user properties like role, email, or password (Admin Only)."""
    with db_manager.get_session() as session:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent admin from demoting/changing their own role
        if user_id == current_admin_id and req.role is not None and req.role != "Admin":
            raise HTTPException(status_code=400, detail="Admins cannot change their own role.")

        if req.email is not None:
            user.email = req.email
        if req.role is not None:
            if req.role not in ("Admin", "Operator"):
                raise HTTPException(status_code=400, detail="Invalid role value.")
            user.role = req.role
        if req.password is not None:
            user.password = security.get_password_hash(req.password)

        session.add(user)
        session.commit()
        session.refresh(user)
        logger.info(f"USER: Admin {current_admin_id} updated user {user_id}")
        return user.to_dict()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(deps.RoleChecker(UserRole.ADMIN))])
async def delete_user(user_id: int,
                      current_admin_id: int = Depends(deps.get_current_user_id)):
    """Deletes a user account (Admin Only). Admins cannot delete themselves."""
    if user_id == current_admin_id:
        raise HTTPException(status_code=400, detail="Admins cannot delete their own account.")

    with db_manager.get_session() as session:
        user = session.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        session.delete(user)
        session.commit()
        logger.info(f"USER: Admin {current_admin_id} deleted user {user_id}")
        return None
