import logging
import json
import os
from typing import Dict, Any, Optional
from contextlib import contextmanager
from sqlalchemy import create_engine, func, case
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from app.core.config import settings
from app.db.models import Base, User, PurchaseOrder, LineItem, ProcessingLog

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.get_database_url(), 
    poolclass=QueuePool, 
    pool_size=5, 
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

class DatabaseManager:
    """Core SQL engine and session lifecycle orchestrator."""

    def __init__(self, database_url: str = None):
        if database_url:
            self.engine = create_engine(database_url, poolclass=QueuePool, pool_size=5, max_overflow=10)
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            # Create tables for custom (e.g. test) database
            Base.metadata.create_all(bind=self.engine)
        else:
            self.engine = engine
            self.SessionLocal = SessionLocal
            # Default engine tables are created via init_db() called during app startup

    @contextmanager
    def get_session(self) -> Session:
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_po_data(self, po_number: str) -> Optional[Dict[str, Any]]:
        """Retrieve PO and its line items."""
        with self.get_session() as session:
            po = session.query(PurchaseOrder).filter_by(po_number=po_number.strip()).first()
            return po.to_dict() if po else None

class ProcessingMonitor:
    """Analytics and audit logging service for invoice lifecycle events."""

    def __init__(self, database_manager: DatabaseManager = None):
        self.db = database_manager or DatabaseManager()

    def log_processing(self, filepath: str, result: Dict[str, Any], duration: float, owner_id: int = None, error_message: str = None):
        """Creates a permanent audit record of a processing session."""
        with self.db.get_session() as session:
            try:
                inv = result.get("invoice_data", {})
                full_metadata = {
                    "invoice_data": inv,
                    "po_data": result.get("po_data", {}),
                    "comparison_result": result.get("comparison_result", {}),
                    "error_message": error_message or result.get("error_message")
                }
                
                log = ProcessingLog(
                    filepath=filepath,
                    po_number=inv.get("po_number"),
                    status=result.get("status", "failed"),
                    error_message=error_message or result.get("error_message"),
                    processing_time_seconds=duration,
                    confidence_score=float(inv.get("confidence_score") or 1.0),
                    metadata_json=json.dumps(full_metadata),
                    owner_id=owner_id
                )
                session.add(log)
            except Exception as e:
                logger.error(f"Failed to log processing: {e}")

    def get_stats(self, owner_id: int = None) -> Dict[str, Any]:
        """Calculate high-level performance metrics."""
        with self.db.get_session() as session:
            query = session.query(
                func.count(ProcessingLog.id).label('total'),
                func.sum(case((ProcessingLog.status == 'completed', 1), else_=0)).label('success'),
                func.avg(ProcessingLog.processing_time_seconds).label('avg_time')
            )
            if owner_id:
                query = query.filter(ProcessingLog.owner_id == owner_id)
            
            stats = query.first()
            return {
                "total_processed": stats.total or 0,
                "successful": stats.success or 0,
                "avg_processing_time": round(stats.avg_time or 0, 2)
            }

    def get_logs(self, owner_id: int = None, limit: int = 50) -> list:
        """Retrieve audit logs with uploader information."""
        with self.db.get_session() as session:
            # Join with User to get the username
            query = session.query(
                ProcessingLog, 
                User.username
            ).outerjoin(
                User, ProcessingLog.owner_id == User.id
            ).order_by(
                ProcessingLog.timestamp.desc()
            )
            
            if owner_id:
                query = query.filter(ProcessingLog.owner_id == owner_id)
            
            results = query.limit(limit).all()
            
            return [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "filepath": log.filepath,
                    "po_number": log.po_number,
                    "status": log.status,
                    "processing_time_seconds": log.processing_time_seconds,
                    "confidence_score": log.confidence_score,
                    "error_message": log.error_message,
                    "metadata_json": log.metadata_json,
                    "owner_id": log.owner_id,
                    "uploader_name": uploader_name
                }
                for log, uploader_name in results
            ]

    def delete_log(self, log_id: int, owner_id: int = None) -> bool:
        """Deletes a log entry and its file."""
        with self.db.get_session() as session:
            query = session.query(ProcessingLog).filter_by(id=log_id)
            if owner_id:
                query = query.filter(ProcessingLog.owner_id == owner_id)
                
            log = query.first()
            if not log:
                return False
            
            try:
                if log.filepath and os.path.exists(log.filepath):
                    os.remove(log.filepath)
            except Exception as e:
                logger.warning(f"Failed to delete file {log.filepath}: {e}")
                
            session.delete(log)
            return True
