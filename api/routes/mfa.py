"""MFA (Multi-Factor Authentication) API routes."""
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from services.two_factor_service import TwoFactorService, AuthEventType


router = APIRouter()


def get_current_user() -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user.
    This is a placeholder - implement your actual authentication logic.
    """
    # This would normally come from your auth middleware/dependency
    return {
        "id": "user_1766682119.873619",  # Example non-UUID ID
        "email": "test@example.com",
        "is_active": True,
    }


def get_two_factor_service() -> TwoFactorService:
    """Dependency to get the two-factor service instance."""
    return TwoFactorService()


def is_valid_uuid(value: str) -> bool:
    """
    Check if a string is a valid UUID.
    
    Args:
        value: String to check
        
    Returns:
        True if the string is a valid UUID, False otherwise
    """
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@router.get("/api/v1/auth/mfa/logs")
async def get_auth_logs(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    suspicious_only: bool = Query(False, description="Only show suspicious events"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: TwoFactorService = Depends(get_two_factor_service),
) -> Dict[str, Any]:
    """
    Get authentication logs for the current user.
    
    This endpoint retrieves MFA authentication logs including login attempts,
    MFA challenges, successes, and failures.
    
    Args:
        event_type: Optional filter by event type (login, mfa_challenge, etc.)
        suspicious_only: Only return suspicious authentication events
        limit: Maximum number of log entries to return (1-100)
        offset: Number of entries to skip for pagination
        current_user: Current authenticated user (injected by dependency)
        service: Two-factor authentication service (injected by dependency)
        
    Returns:
        Dictionary containing the logs and pagination metadata
        
    Raises:
        HTTPException: If the user ID format is invalid or other errors occur
    """
    # Parse event type if provided
    auth_event: Optional[AuthEventType] = None
    if event_type:
        try:
            auth_event = AuthEventType(event_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event type: {event_type}. "
                       f"Valid types are: {[e.value for e in AuthEventType]}"
            )
    
    # Get user ID from current_user
    user_id_raw = current_user.get("id")
    if not user_id_raw:
        raise HTTPException(
            status_code=400,
            detail="User ID not found in authentication context"
        )
    
    # FIX: Handle both UUID and non-UUID user IDs gracefully
    # Instead of forcing conversion to UUID, check if it's a valid UUID first
    if isinstance(user_id_raw, str) and is_valid_uuid(user_id_raw):
        # If it's a valid UUID string, convert it to UUID object
        user_id: str | UUID = UUID(user_id_raw)
    else:
        # Otherwise, keep it as a string (for test users, mock users, etc.)
        user_id = str(user_id_raw)
    
    # Call service with the properly handled user ID
    try:
        logs = service.get_auth_logs(
            user_id=user_id,  # Now properly handles both UUID and string
            event_type=auth_event,
            suspicious_only=suspicious_only,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve authentication logs: {str(e)}"
        )
    
    return {
        "logs": logs,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": len(logs),
        },
        "user_id": str(user_id),  # Return as string for consistency
    }


@router.get("/api/v1/auth/mfa/status")
async def get_mfa_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get MFA status for the current user.
    
    Args:
        current_user: Current authenticated user (injected by dependency)
        
    Returns:
        Dictionary containing MFA status information
    """
    return {
        "user_id": current_user.get("id"),
        "mfa_enabled": False,  # Placeholder
        "mfa_methods": [],  # Placeholder
    }
