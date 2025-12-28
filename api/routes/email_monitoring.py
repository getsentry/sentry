"""
Email Monitoring API Routes

This module provides API endpoints for managing email monitoring configurations.
"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

# Assuming these imports exist in your project
from ..models.email_monitoring_config import EmailMonitoringConfig
from ..dependencies import get_db, get_current_user


router = APIRouter(prefix="/api/v1/email-monitoring", tags=["email-monitoring"])


class EmailConfigResponse(BaseModel):
    """Response model for email configuration."""
    id: str
    email_address: str
    email_provider: str | None
    monitoring_enabled: bool
    sync_frequency_minutes: int | None
    last_sync_at: str | None
    last_sync_status: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def get_user_id_from_token(db: Session) -> UUID:
    """
    Extract and return user ID from authentication token.
    
    This is a fixed version that returns a UUID object instead of a string,
    preventing SQLAlchemy UUID binding errors.
    
    Args:
        db: Database session
        
    Returns:
        UUID: The user's UUID object
        
    Raises:
        HTTPException: If token is invalid or user_id cannot be parsed
    """
    # TODO: Implement actual token extraction logic
    # This is a placeholder that needs to be replaced with your auth logic
    
    # Example implementation:
    # token = get_token_from_header()
    # payload = decode_jwt_token(token)
    # user_id_str = payload.get("user_id")
    
    # For now, using a placeholder
    user_id_str = "00000000-0000-0000-0000-000000000001"
    
    try:
        # CRITICAL FIX: Convert string to UUID object before returning
        # This prevents the AttributeError: 'str' object has no attribute 'hex'
        return UUID(user_id_str)
    except (ValueError, AttributeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid user ID in token: {str(e)}"
        ) from e


@router.get("/config", response_model=List[EmailConfigResponse])
async def get_email_configs(db: Session = Depends(get_db)) -> List[EmailConfigResponse]:
    """
    Get all email configurations for the current user.
    
    This endpoint retrieves all email monitoring configurations associated
    with the authenticated user.
    
    Args:
        db: Database session (injected)
        
    Returns:
        List[EmailConfigResponse]: List of email configurations
        
    Raises:
        HTTPException: If user is not authenticated or database error occurs
    """
    # Get user ID as UUID object (not string)
    user_id: UUID = get_user_id_from_token(db)
    
    # Query with UUID object - SQLAlchemy will properly bind it
    configs = (
        db.query(EmailMonitoringConfig)
        .filter(EmailMonitoringConfig.user_id == user_id)
        .order_by(EmailMonitoringConfig.created_at.desc())
        .all()
    )
    
    return [
        EmailConfigResponse(
            id=str(c.id),
            email_address=c.email_address,
            email_provider=c.email_provider,
            monitoring_enabled=c.monitoring_enabled,
            sync_frequency_minutes=c.sync_frequency_minutes,
            last_sync_at=c.last_sync_at.isoformat() if c.last_sync_at else None,
            last_sync_status=c.last_sync_status,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in configs
    ]


@router.get("/config/{config_id}", response_model=EmailConfigResponse)
async def get_email_config(
    config_id: str,
    db: Session = Depends(get_db)
) -> EmailConfigResponse:
    """
    Get a specific email configuration by ID.
    
    Args:
        config_id: The email configuration ID
        db: Database session (injected)
        
    Returns:
        EmailConfigResponse: The email configuration
        
    Raises:
        HTTPException: If configuration not found or user not authorized
    """
    user_id: UUID = get_user_id_from_token(db)
    
    try:
        config_uuid = UUID(config_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid configuration ID format"
        ) from e
    
    config = (
        db.query(EmailMonitoringConfig)
        .filter(
            EmailMonitoringConfig.id == config_uuid,
            EmailMonitoringConfig.user_id == user_id
        )
        .first()
    )
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email configuration not found"
        )
    
    return EmailConfigResponse(
        id=str(config.id),
        email_address=config.email_address,
        email_provider=config.email_provider,
        monitoring_enabled=config.monitoring_enabled,
        sync_frequency_minutes=config.sync_frequency_minutes,
        last_sync_at=config.last_sync_at.isoformat() if config.last_sync_at else None,
        last_sync_status=config.last_sync_status,
        created_at=config.created_at.isoformat(),
        updated_at=config.updated_at.isoformat(),
    )


# Additional endpoints would go here...
