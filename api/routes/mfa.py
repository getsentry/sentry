"""
Multi-Factor Authentication API routes.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from enum import Enum


router = APIRouter()


class AuthEventType(str, Enum):
    """Authentication event types."""
    LOGIN = "login"
    LOGOUT = "logout"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    MFA_VERIFIED = "mfa_verified"
    MFA_FAILED = "mfa_failed"


def is_valid_uuid(uuid_string: str) -> bool:
    """
    Check if a string is a valid UUID.
    
    Args:
        uuid_string: String to validate
        
    Returns:
        True if the string is a valid UUID, False otherwise
    """
    try:
        UUID(uuid_string)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@router.get("/logs")
async def get_auth_logs(
    current_user: dict = Depends(),  # This would be a dependency injection
    event_type: Optional[str] = Query(None),
    suspicious_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service = Depends(),  # TwoFactorService dependency
):
    """
    Get authentication logs for the current user.
    
    Args:
        current_user: Current authenticated user
        event_type: Filter by event type
        suspicious_only: Return only suspicious events
        limit: Maximum number of results
        offset: Offset for pagination
        service: Two-factor authentication service
        
    Returns:
        List of authentication logs
    """
    # Parse event type if provided
    auth_event = None
    if event_type is not None:
        try:
            auth_event = AuthEventType(event_type)
        except ValueError:
            pass

    # FIX: Handle non-UUID user IDs
    # Before: logs = service.get_auth_logs(user_id=UUID(current_user["id"]), ...)
    # After: Check if the ID is a valid UUID before casting
    
    user_id_str = current_user["id"]
    
    # If the user ID is a valid UUID, convert it to UUID object
    # Otherwise, pass it as a string (the service should handle both)
    if is_valid_uuid(user_id_str):
        user_id = UUID(user_id_str)
    else:
        # For non-UUID user IDs (like test users or legacy IDs),
        # pass the string directly
        user_id = user_id_str

    logs = service.get_auth_logs(
        user_id=user_id,
        event_type=auth_event,
        suspicious_only=suspicious_only,
        limit=limit,
        offset=offset,
    )

    return logs
