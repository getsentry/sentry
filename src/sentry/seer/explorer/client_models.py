"""
Pydantic models for Seer Explorer client.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ToolCall(BaseModel):
    """A tool call in a message."""

    function: str
    args: str


class Message(BaseModel):
    """A message in the conversation."""

    role: Literal["user", "assistant", "tool_use"]
    content: str | None = None
    tool_calls: list[ToolCall] | None = None


class MemoryBlock(BaseModel):
    """A block in the Explorer agent's conversation/memory."""

    id: str
    message: Message
    timestamp: str
    loading: bool = False


class SeerRunState(BaseModel):
    """State of a Seer Explorer session."""

    run_id: int
    blocks: list[MemoryBlock]
    status: Literal["processing", "completed", "error"]
    updated_at: str
