"""Email Monitoring API Routes."""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from api.models.email_monitoring_config import EmailMonitoringConfig
from api.models.monitored_email import MonitoredEmail
from api.models.email_status_update import EmailStatusUpdate
from api.utils import ensure_uuid, generate_uuid_str

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/email-monitoring", tags=["email-monitoring"])


# Dependency to get database session (implementation depends on your setup)
def get_db() -> Session:
    """Get database session. This should be implemented based on your DB setup."""
    # This is a placeholder - implement based on your application's DB session management
    raise NotImplementedError("Database session dependency must be implemented")


def get_current_user_id(request: Request) -> UUID:
    """
    Get current user ID from request.
    
    This should be implemented based on your authentication system.
    Returns a UUID object, not a string.
    """
    # This is a placeholder - implement based on your authentication system
    # IMPORTANT: Must return a UUID object, not a string
    raise NotImplementedError("User authentication must be implemented")


class SyncRequest(BaseModel):
    """Request model for triggering email sync."""
    
    config_id: Optional[UUID] = None


class SyncResponse(BaseModel):
    """Response model for sync trigger."""
    
    job_id: str
    configs_count: int
    message: str


@router.post("/sync", response_model=SyncResponse)
async def trigger_sync(
    request: Request,
    sync_request: SyncRequest,
    db: Session = Depends(get_db),
) -> SyncResponse:
    """
    Trigger email synchronization for user's email configurations.
    
    Args:
        request: FastAPI request object
        sync_request: Sync request containing optional config_id
        db: Database session
        
    Returns:
        SyncResponse with job details
        
    Raises:
        HTTPException: If no enabled configurations found
    """
    try:
        # Get current user ID - THIS MUST RETURN A UUID OBJECT
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure user_id is a UUID object, not a string
        user_id = ensure_uuid(user_id)
        
        logger.info(f"Triggering sync for user_id={user_id}, config_id={sync_request.config_id}")
        
        # Build query to find enabled email configurations
        query = db.query(EmailMonitoringConfig).filter(
            and_(
                EmailMonitoringConfig.user_id == user_id,  # Now user_id is a UUID object
                EmailMonitoringConfig.monitoring_enabled == True
            )
        )
        
        # Filter by specific config if provided
        if sync_request.config_id:
            # CRITICAL FIX: Ensure config_id is also a UUID object
            config_id = ensure_uuid(sync_request.config_id)
            query = query.filter(EmailMonitoringConfig.id == config_id)
        
        # Execute query
        configs = query.all()
        
        if not configs:
            raise HTTPException(
                status_code=404,
                detail="No enabled email configurations found"
            )
        
        # Create sync job ID
        job_id = generate_uuid_str()
        
        # Here you would typically enqueue background jobs for each config
        # For now, just return the response
        logger.info(f"Created sync job {job_id} for {len(configs)} configurations")
        
        return SyncResponse(
            job_id=job_id,
            configs_count=len(configs),
            message=f"Sync initiated for {len(configs)} email configuration(s)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to trigger sync: {str(e)}")


@router.get("/configs")
async def get_configs(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get email monitoring configurations for current user."""
    try:
        # Get current user ID
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure user_id is a UUID object
        user_id = ensure_uuid(user_id)
        
        configs = db.query(EmailMonitoringConfig).filter(
            EmailMonitoringConfig.user_id == user_id
        ).all()
        
        return {"configs": configs}
        
    except Exception as e:
        logger.error(f"Error fetching configs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch configs: {str(e)}")


@router.post("/configure")
async def configure_email_monitoring(
    request: Request,
    db: Session = Depends(get_db),
):
    """Configure email monitoring for current user."""
    try:
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure user_id is a UUID object
        user_id = ensure_uuid(user_id)
        
        # Implementation for configuring email monitoring
        # This is a placeholder
        return {"message": "Configuration endpoint"}
        
    except Exception as e:
        logger.error(f"Error configuring email monitoring: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure: {str(e)}")


@router.patch("/config/{config_id}/toggle")
async def toggle_monitoring(
    config_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    """Toggle monitoring enabled/disabled for a specific configuration."""
    try:
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure IDs are UUID objects
        user_id = ensure_uuid(user_id)
        config_id = ensure_uuid(config_id)
        
        config = db.query(EmailMonitoringConfig).filter(
            and_(
                EmailMonitoringConfig.id == config_id,
                EmailMonitoringConfig.user_id == user_id
            )
        ).first()
        
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")
        
        config.monitoring_enabled = not config.monitoring_enabled
        config.updated_at = datetime.utcnow()
        db.commit()
        
        return {
            "config_id": str(config.id),
            "monitoring_enabled": config.monitoring_enabled
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling monitoring: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to toggle monitoring: {str(e)}")


class StatusUpdateResponse(BaseModel):
    """Response model for status updates."""
    
    id: str
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    status: Optional[str] = None
    status_category: Optional[str] = None
    auto_applied: bool = False
    requires_review: bool = True
    review_reason: Optional[str] = None
    created_at: datetime


class MonitoringStatsResponse(BaseModel):
    """Response model for monitoring statistics."""
    
    total_emails: int
    ats_emails: int
    total_updates: int
    auto_applied: int
    pending_review: int


@router.get("/status-updates")
async def get_status_updates(
    request: Request,
    pending_review: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Get status updates for current user.
    
    Args:
        request: FastAPI request object
        pending_review: Filter for updates requiring review
        limit: Maximum number of results
        db: Database session
        
    Returns:
        List of status updates
    """
    try:
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure user_id is a UUID object
        user_id = ensure_uuid(user_id)
        
        # Build query joining through the relationships
        query = db.query(EmailStatusUpdate).join(
            MonitoredEmail
        ).join(
            EmailMonitoringConfig
        ).filter(
            EmailMonitoringConfig.user_id == user_id
        )
        
        # Apply filters
        if pending_review is not None:
            query = query.filter(EmailStatusUpdate.requires_review == pending_review)
        
        # Limit results
        updates = query.limit(limit).all()
        
        return {
            "updates": [
                StatusUpdateResponse(
                    id=str(update.id),
                    company_name=update.company_name,
                    job_title=update.job_title,
                    status=update.status,
                    status_category=update.status_category,
                    auto_applied=update.auto_applied,
                    requires_review=update.requires_review,
                    review_reason=update.review_reason,
                    created_at=update.created_at
                )
                for update in updates
            ]
        }
        
    except Exception as e:
        logger.error(f"Error fetching status updates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch status updates: {str(e)}")


@router.post("/status-updates/{update_id}/feedback")
async def submit_feedback(
    update_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Submit feedback on a status update.
    
    Args:
        update_id: ID of the status update
        request: FastAPI request object
        db: Database session
        
    Returns:
        Updated status update
    """
    try:
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure IDs are UUID objects
        user_id = ensure_uuid(user_id)
        update_id = ensure_uuid(update_id)
        
        # Find the update, ensuring it belongs to the user
        update = db.query(EmailStatusUpdate).join(
            MonitoredEmail
        ).join(
            EmailMonitoringConfig
        ).filter(
            and_(
                EmailStatusUpdate.id == update_id,
                EmailMonitoringConfig.user_id == user_id
            )
        ).first()
        
        if not update:
            raise HTTPException(status_code=404, detail="Status update not found")
        
        # Here you would process the feedback from the request body
        # For now, just mark it as reviewed
        update.requires_review = False
        update.updated_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Feedback submitted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


@router.get("/stats", response_model=MonitoringStatsResponse)
async def get_monitoring_stats(
    request: Request,
    db: Session = Depends(get_db),
) -> MonitoringStatsResponse:
    """
    Get monitoring statistics for current user.
    
    This endpoint retrieves aggregated statistics about monitored emails,
    ATS emails, status updates, and pending reviews.
    
    Args:
        request: FastAPI request object
        db: Database session
        
    Returns:
        MonitoringStatsResponse with statistics
        
    Raises:
        HTTPException: If there's an error fetching statistics
    """
    try:
        user_id = get_current_user_id(request)
        
        # CRITICAL FIX: Ensure user_id is a UUID object, not a string
        # This is THE KEY FIX for the AttributeError: 'str' object has no attribute 'hex'
        user_id = ensure_uuid(user_id)
        
        logger.info(f"Fetching monitoring stats for user_id={user_id} (type: {type(user_id)})")
        
        # Get email stats - count total emails and ATS emails
        email_stats = db.query(
            func.count(MonitoredEmail.id).label("total_emails"),
            func.count(MonitoredEmail.id).filter(MonitoredEmail.is_ats_email == True).label("ats_emails"),
        ).join(
            EmailMonitoringConfig
        ).filter(
            EmailMonitoringConfig.user_id == user_id  # Now user_id is a UUID object, not a string
        ).first()
        
        # Get status update stats
        update_stats = db.query(
            func.count(EmailStatusUpdate.id).label("total_updates"),
            func.count(EmailStatusUpdate.id).filter(EmailStatusUpdate.auto_applied == True).label("auto_applied"),
            func.count(EmailStatusUpdate.id).filter(EmailStatusUpdate.requires_review == True).label("pending_review"),
        ).join(
            MonitoredEmail
        ).join(
            EmailMonitoringConfig
        ).filter(
            EmailMonitoringConfig.user_id == user_id  # Now user_id is a UUID object, not a string
        ).first()
        
        return MonitoringStatsResponse(
            total_emails=email_stats.total_emails or 0,
            ats_emails=email_stats.ats_emails or 0,
            total_updates=update_stats.total_updates or 0,
            auto_applied=update_stats.auto_applied or 0,
            pending_review=update_stats.pending_review or 0
        )
        
    except Exception as e:
        logger.error(f"Error fetching monitoring stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch monitoring stats: {str(e)}")

