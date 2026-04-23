import logging
import time
import json
import asyncio
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.db.session import ProcessingMonitor
from app.agents.graph import invoice_matching_app
from app.schemas.invoice import ProcessingResponse

from app.api import deps
from app.core.roles import UserRole
from app.services.events import global_event_bus

router = APIRouter()
logger = logging.getLogger(__name__)
monitor = ProcessingMonitor()

@router.post("/upload", response_model=ProcessingResponse)
async def upload_invoice(
    file: UploadFile = File(...),
    role: str = Depends(deps.get_current_user_role)
):
    """
    Handles PDF uploads and prepares them for processing.
    STRICT ROLE LOCK: Only Operators are permitted to upload.
    """
    if role != UserRole.OPERATOR.value:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Only Users with 'Operator' role are permitted to upload invoices."
        )

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files supported")
    
    task_id = f"task_{int(time.time() * 1000)}"
    # Sanitize filename to prevent directory traversal
    safe_filename = Path(file.filename).name
    filepath = settings.temp_dir / f"{task_id}_{safe_filename}"
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
        
    return ProcessingResponse(
        status="accepted",
        message="Invoice uploaded successfully.",
        task_id=task_id,
        filepath=str(filepath)
    )


@router.get("/stream/global", dependencies=[Depends(deps.RoleChecker(UserRole.OPERATOR))])
async def stream_global():
    """Permanent connection that broadcasts ALL AI activity across the system."""
    async def global_event_generator():
        logger.info("New client connected to Global AI Stream")
        queue = global_event_bus.subscribe()
        try:
            # Send initial greeting
            yield f"data: {json.dumps({'node': 'system', 'status': 'connected', 'message': 'Neural Link Established'})}\n\n"
            
            while True:
                message = await queue.get()
                yield f"data: {message}\n\n"
        finally:
            global_event_bus.unsubscribe(queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Content-Type": "text/event-stream",
        "Access-Control-Allow-Origin": "*"
    }
    return StreamingResponse(global_event_generator(), headers=headers)


@router.get("/stream/{task_id}", dependencies=[Depends(deps.RoleChecker(UserRole.OPERATOR))])
async def stream_processing(task_id: str, user_id: int = Depends(deps.get_current_user_id)):
    """
    Executes the AI orchestration pipeline and streams progress via SSE.
    SECURITY: Resolves the filepath based on task_id to prevent traversal.
    """
    # Find the file in temp_dir that starts with this task_id
    files = list(settings.temp_dir.glob(f"{task_id}_*"))
    if not files:
        raise HTTPException(status_code=404, detail="Processing task not found or expired.")
    
    filepath = str(files[0])
    
    async def event_generator():
        logger.info(f"Starting task-specific stream for {task_id}")
        start_time = time.time()
        initial_state = {
            "invoice_data": {},
            "po_data": {},
            "comparison_result": {},
            "status": "pending",
            "filepath": filepath,
            "error_message": "",
            "raw_text": "",
            "requires_human_review": False
        }
        
        config = {"configurable": {"thread_id": task_id}}
        
        try:
            start_payload = {'node': 'start', 'status': 'Initiated', 'message': f'AI Orchestrator assigned to task {task_id}', 'task_id': task_id}
            await global_event_bus.broadcast(start_payload)
            yield f"data: {json.dumps(start_payload)}\n\n"
            
            async for event in invoice_matching_app.astream(initial_state, config=config, stream_mode="updates"):
                for node_name, node_data in event.items():
                    status_str = node_data.get("status", "working")
                    
                    # Filter internal fields 
                    filtered_node_data = {k: v for k, v in node_data.items() if k != "_original_text" and not k.startswith("_")}
                    
                    # Internal node labels mapping
                    if node_name == "__start__":
                        filtered_node_data = {"session": "initialized", "message": "AI agent woke up. Awaiting file analysis..."}
                    elif node_name == "__end__":
                        filtered_node_data = {"session": "concluded", "message": "All AI nodes finished. Process ended."}

                    # Generate 'short reason' for better UI feedback
                    reason = node_data.get("message") or filtered_node_data.get("message")
                    if not reason:
                        if node_name == "extract_invoice":
                            items = node_data.get("invoice_data", {}).get("items", [])
                            reason = f"Extracted {len(items)} items from document"
                        elif node_name == "validate_invoice":
                            reason = "Structure & confidence validation passed"
                        elif node_name == "match_po":
                            po = node_data.get("invoice_data", {}).get("po_number", "N/A")
                            reason = f"Cross-referencing with PO: {po}"
                        else:
                            reason = "Processing neural data fragments..."

                    payload = {
                        "node": node_name.replace("__", ""),
                        "status": status_str,
                        "update": filtered_node_data,
                        "reason": reason,
                        "task_id": task_id,
                        "source": "upload"
                    }
                    
                    # Broadcast globally
                    await global_event_bus.broadcast(payload)
                    
                    yield f"data: {json.dumps(payload)}\n\n"
                    # Small delay to ensure UI can keep up with rapid node transitions
                    # Reduced from 0.4s to 0.1s for better efficiency while maintaining visual updates
                    await asyncio.sleep(0.1)
                
            # Log final results to DB once stream finishes
            final_state = await invoice_matching_app.aget_state(config)
            processing_time = time.time() - start_time
            monitor.log_processing(filepath, final_state.values, processing_time, owner_id=user_id)
            
            # Final payload
            final_payload = {'node': 'end', 'status': 'completed', 'task_id': task_id, 'message': 'Pipeline execution finished successfully.'}
            await global_event_bus.broadcast(final_payload)
            yield f"data: {json.dumps(final_payload)}\n\n"
            
        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            err_payload = {'node': 'error', 'status': 'failed', 'error': str(e), 'task_id': task_id}
            await global_event_bus.broadcast(err_payload)
            yield f"data: {json.dumps(err_payload)}\n\n"
            
        finally:
            # CLEANUP: Delete the file to prevent orphans
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.info(f"Cleanup: Deleted temp file {filepath}")
            except Exception as clean_err:
                logger.warning(f"Cleanup failed for {filepath}: {clean_err}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )
