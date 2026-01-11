"""Networking routes for connection requests."""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from api.schemas import ConnectionRequestCreate, ConnectionRequest
from api.services import create_connection_request


router = APIRouter(prefix="/networking", tags=["networking"])


# Mock user dependency - in real app this would validate JWT tokens, etc.
class User:
    def __init__(self, id: str):
        self.id = id


def get_current_user() -> User:
    """Mock function to get current user."""
    return User(id="040dc2a4-7ba0-40a5-b307-4153b570362b")


@router.post("/connections/request")
async def send_connection_request(
    request: ConnectionRequestCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Send a connection request to another user.
    
    FIXED: Now properly handles ConnectionRequest Pydantic model returned by service.
    """
    try:
        conn_request = create_connection_request(
            from_user_id=current_user.id,
            to_user_id=request.to_user_id,
            message=request.message
        )
        return {
            "success": True,
            "data": conn_request.model_dump(),  # FIXED: conn_request is now a Pydantic model
            "message": "Connection request sent"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections/requests")
async def get_connection_requests(
    status: Optional[str] = Query(None, description="Filter by status: pending, accepted, rejected"),
    current_user: User = Depends(get_current_user)
):
    """Get connection requests for the current user."""
    # Mock implementation
    return {
        "success": True,
        "data": [],
        "message": "Connection requests retrieved"
    }


@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user's profile."""
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "name": "Test User"
        }
    }


@router.get("/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Get another user's profile."""
    return {
        "success": True,
        "data": {
            "id": user_id,
            "name": "Other User"
        }
    }


@router.put("/profile")
async def update_profile(
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile."""
    return {
        "success": True,
        "message": "Profile updated"
    }
