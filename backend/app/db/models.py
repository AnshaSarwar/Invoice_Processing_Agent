import json
from typing import Dict, Any
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, 
    DateTime, ForeignKey, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    """Stores user credentials, contact info, and hierarchical roles."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password = Column(Text, nullable=False)
    email = Column(String(100))
    role = Column(String(20), nullable=False) # Admin, Operator
    created_at = Column(DateTime, default=datetime.utcnow)

    logs = relationship("ProcessingLog", back_populates="owner")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class PurchaseOrder(Base):
    """Represents a formal request for goods or services."""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    po_number = Column(String(100), unique=True, nullable=False, index=True)
    supplier = Column(String(255))
    tax = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    
    line_items = relationship("LineItem", back_populates="purchase_order", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "po_number": self.po_number,
            "supplier": self.supplier,
            "tax": self.tax,
            "total_amount": self.total_amount,
            "line_items": [item.to_dict() for item in self.line_items]
        }

class LineItem(Base):
    """Individual item entry within a purchase order."""
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    po_number = Column(String(100), ForeignKey("purchase_orders.po_number", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="line_items")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "description": self.description,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "total_price": self.total_price,
        }

class ProcessingLog(Base):
    """Analytics and audit logging service for invoice lifecycle events."""
    __tablename__ = "processing_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    filepath = Column(String(500))
    po_number = Column(String(100))
    status = Column(String(50), index=True)
    error_message = Column(Text)
    processing_time_seconds = Column(Float)
    confidence_score = Column(Float)
    metadata_json = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    owner = relationship("User", back_populates="logs")

class SystemState(Base):
    """Global system status and concurrency locks."""
    __tablename__ = "system_state"

    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True, nullable=False)
    is_locked = Column(Integer, default=0) # 0 = False, 1 = True
    last_updated = Column(DateTime, default=datetime.utcnow)
