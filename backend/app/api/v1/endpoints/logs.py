import logging
from fastapi import APIRouter, HTTPException, Depends
from app.db.session import ProcessingMonitor
from app.api import deps
from app.core.roles import UserRole

router = APIRouter()
logger = logging.getLogger(__name__)
monitor = ProcessingMonitor()

@router.get("/logs", response_model=list)
async def get_logs(
    user_id: int = Depends(deps.get_current_user_id),
    role: str = Depends(deps.get_current_user_role),
    limit: int = 50
):
    """Retrieves processing logs with hierarchical filtering."""
    try:
        owner_filter = user_id if (role == UserRole.OPERATOR.value) else None
        logs = monitor.get_logs(owner_id=owner_filter, limit=limit)
        return logs
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(
    user_id: int = Depends(deps.get_current_user_id),
    role: str = Depends(deps.get_current_user_role)
):
    """Calculates performance statistics for the authorized user."""
    try:
        owner_filter = user_id if (role == UserRole.OPERATOR.value) else None
        stats = monitor.get_stats(owner_id=owner_filter)
        
        total = stats.get("total_processed") or 0
        successful = stats.get("successful") or 0
        return {
            "total": total,
            "successful": successful,
            "failed": max(0, total - successful),
            "avg_time": stats.get("avg_processing_time") or 0
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/logs/{log_id}")
async def delete_log_endpoint(
    log_id: int, 
    user_id: int = Depends(deps.get_current_user_id),
    role: str = Depends(deps.get_current_user_role)
):
    """
    Deletes a log entry and its associated file.
    Permitted for: Admins or the original uploader (Owner).
    """
    # Passing owner_id to monitor.delete_log handles the specific ownership check 
    # if the user is an Operator. Admins get 'None' as owner_filter 
    # so they can delete anything.
    owner_filter = user_id if role == UserRole.OPERATOR.value else None
    
    success = monitor.delete_log(log_id, owner_id=owner_filter)
    
    if not success:
        # If success is false, it means either the log didn't exist or 
        # the user wasn't the owner (and wasn't an Admin)
        raise HTTPException(
            status_code=403 if monitor.log_exists(log_id) else 404, 
            detail="Log entry not found or you don't have permission to delete it"
        )
        
    return {"status": "success", "message": f"Log {log_id} and associated file deleted."}
