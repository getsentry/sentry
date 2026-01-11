"""Service layer for connection requests."""
import uuid
from datetime import datetime

from api.schemas import ConnectionRequest


def create_connection_request(
    from_user_id: str,
    to_user_id: str,
    message: str
) -> ConnectionRequest:
    """
    Create a connection request.
    
    FIXED: Now returns a ConnectionRequest Pydantic model instead of a dict.
    """
    # Simulating database insertion
    connection_request_data = {
        "id": str(uuid.uuid4()),
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # FIXED: Return a ConnectionRequest Pydantic model
    return ConnectionRequest(**connection_request_data)
