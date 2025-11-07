"""
Pydantic models for Seer Explorer client.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ToolCall(BaseModel):
    """A tool call in a message."""

    function: str
    args: str

    class Config:
        extra = "allow"


class Message(BaseModel):
    """A message in the conversation."""

    role: Literal["user", "assistant", "tool_use"]
    content: str | None = None
    tool_calls: list[ToolCall] | None = None

    class Config:
        extra = "allow"


class MemoryBlock(BaseModel):
    """A block in the Explorer agent's conversation/memory."""

    id: str
    message: Message
    timestamp: str
    loading: bool = False

    class Config:
        extra = "allow"


class SeerRunState(BaseModel):
    """State of a Seer Explorer session."""

    run_id: int
    blocks: list[MemoryBlock]
    status: Literal["processing", "completed", "error"]
    updated_at: str

    class Config:
        extra = "allow"


class ExplorerRun(BaseModel):
    """A single Explorer run record with metadata."""

    run_id: int
    title: str
    last_triggered_at: datetime
    created_at: datetime
    category_key: str | None = None
    category_value: str | None = None

    class Config:
        extra = "allow"
