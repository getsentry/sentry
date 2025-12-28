"""Email Monitoring API Routes."""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from api.models.email_monitoring_config import EmailMonitoringConfig
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


def get_user_id_from_token(db: Session) -> str:
    """
    Get user ID from authentication token.
    
    This is a placeholder implementation that should be replaced with
    actual token verification logic.
    
    Args:
        db: Database session
        
    Returns:
        User ID as string
        
    Note:
        This function returns a string, which must be converted to UUID
        before using in SQLAlchemy queries.
    """
    # Placeholder implementation - replace with actual auth logic
    # For now, return a test UUID string
    return "00000000-0000-0000-0000-000000000001"


class EmailConfigResponse(BaseModel):
    """Response model for email configuration."""
    
    id: str
    email_address: str
    email_provider: str
    monitoring_enabled: bool
    sync_frequency_minutes: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime


@router.get("/config")
async def get_email_configs(
    db: Session = Depends(get_db),
):
    """Get all email configurations for the current user."""
    try:
        # Get user ID from token - returns string
        user_id = get_user_id_from_token(db)
        
        # CRITICAL FIX: Convert string to UUID object before using in query
        # SQLAlchemy's UUID bind processor expects a UUID object with .hex attribute
        # Passing a string causes: AttributeError: 'str' object has no attribute 'hex'
        user_id = ensure_uuid(user_id)
        
        configs = db.query(EmailMonitoringConfig).filter(
            EmailMonitoringConfig.user_id == user_id
        ).order_by(EmailMonitoringConfig.created_at.desc()).all()
        
        return [
            EmailConfigResponse(
                id=str(c.id),
                email_address=c.email_address,
                email_provider=c.email_provider,
                monitoring_enabled=c.monitoring_enabled,
                sync_frequency_minutes=c.sync_frequency_minutes,
                last_sync_at=c.last_sync_at,
                last_sync_status=c.last_sync_status,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in configs
        ]
        
    except Exception as e:
        logger.error(f"Error fetching configs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch configs: {str(e)}")


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
