"""
Utility functions for Claude Code Agent integration.
"""

from enum import StrEnum


class ClaudeSessionStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    IDLE = "idle"
    CLOSED = "closed"
