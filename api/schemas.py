"""Pydantic schemas for the networking API."""
from pydantic import BaseModel
from typing import Optional


class ConnectionRequestCreate(BaseModel):
    """Schema for creating a connection request."""
    to_user_id: str
    message: str


class ConnectionRequest(BaseModel):
    """Schema for a connection request response."""
    id: str
    from_user_id: str
    to_user_id: str
    message: str
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True
