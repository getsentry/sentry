"""
Example FastAPI networking routes demonstrating async dependency injection.

This module simulates the code from the Sentry error report:
HTTPException: object MagicMock can't be used in 'await' expression
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel


# Models
class ConnectionResponseRequest(BaseModel):
    request_id: str
    accept: bool


# Service class (simulated)
class NetworkingService:
    """Service that handles networking connections."""
    
    async def respond_to_request(
        self, user_id: str, request_id: str, accept: bool
    ) -> dict:
        """
        Respond to a connection request.
        
        Args:
            user_id: The user responding to the request
            request_id: The connection request ID
            accept: Whether to accept or reject
            
        Returns:
            dict with result information
        """
        # Simulated async operation
        return {
            "request_id": request_id,
            "status": "accepted" if accept else "rejected",
            "user_id": user_id
        }


# Dependency injection
def get_networking_service() -> NetworkingService:
    """Dependency that provides the networking service."""
    return NetworkingService()


def get_current_user() -> dict:
    """Dependency that provides the current user (simulated)."""
    return {
        "user_id": "168366f4-bebc-4e65-a14f-725aec84554f",
        "email": "john@example.com",
        "name": "John Smith"
    }


# Router
router = APIRouter(prefix="/api/v1/networking", tags=["networking"])


@router.post("/connections/respond")
async def respond_to_connection(
    request: ConnectionResponseRequest,
    current_user: dict = Depends(get_current_user),
    service: NetworkingService = Depends(get_networking_service),
) -> dict:
    """
    Accept or reject a connection request.
    
    This is the endpoint that was failing in the Sentry error report
    when the service was mocked incorrectly with MagicMock instead of AsyncMock.
    """
    try:
        # THIS IS LINE 207 FROM THE ERROR REPORT
        # The issue occurs here when service is a MagicMock instead of AsyncMock
        result = await service.respond_to_request(
            user_id=current_user["user_id"],
            request_id=request.request_id,
            accept=request.accept
        )
        return {
            "success": True,
            "request_id": request.request_id,
            "message": "Request accepted" if request.accept else "Request declined"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # THIS IS LINE 220 FROM THE ERROR REPORT
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections")
async def get_connections(
    relationship_type: Optional[str] = Query(None, description="Filter by relationship type"),
    current_user: dict = Depends(get_current_user),
    service: NetworkingService = Depends(get_networking_service),
) -> dict:
    """Get user connections."""
    return {"connections": [], "total": 0}
