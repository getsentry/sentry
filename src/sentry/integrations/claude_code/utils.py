"""
Utility functions for Claude Code Agent integration.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ClaudeSessionEventStatus(StrEnum):
    RESCHEDULING = "session.status_rescheduling"
    RUNNING = "session.status_running"
    IDLE = "session.status_idle"
    TERMINATED = "session.status_terminated"


class ClaudeSessionEvent(BaseModel):
    id: str | None = None
    type: str
    processed_at: datetime | None = None

    class Config:
        extra = "allow"
