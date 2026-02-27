"""
Utility functions for Claude Code Agent integration.
"""

from __future__ import annotations


def map_session_status(claude_status: str) -> str:
    """
    Map Claude Code session status to a normalized status.

    Args:
        claude_status: Status from Claude Code API.

    Returns:
        Normalized status string.
    """
    status_mapping = {
        "pending": "pending",
        "running": "running",
        "idle": "completed",
        "closed": "completed",
    }
    return status_mapping.get(claude_status.lower(), "running")
