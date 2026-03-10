"""
Utility functions for Claude Code Agent integration.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ClaudeSessionEventStatus(StrEnum):
    PENDING = "status_pending"
    RUNNING = "status_running"
    IDLE = "status_idle"
    CLOSED = "status_closed"


class ClaudeSessionEvent(BaseModel):
    id: str | None = None
    type: str
    processed_at: datetime | None = None

    class Config:
        extra = "allow"
