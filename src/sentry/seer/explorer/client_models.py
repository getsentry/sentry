"""
Pydantic models for Seer Explorer client.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


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


class Artifact(BaseModel):
    """An artifact generated during an Explorer run."""

    key: str
    data: dict[str, Any] | None = None
    reason: str

    class Config:
        extra = "allow"


class MemoryBlock(BaseModel):
    """A block in the Explorer agent's conversation/memory."""

    id: str
    message: Message
    timestamp: str
    loading: bool = False
    artifacts: list[Artifact] = []

    class Config:
        extra = "allow"


class PendingUserInput(BaseModel):
    """A pending user input request from the agent."""

    id: str
    input_type: str
    data: dict[str, Any]

    class Config:
        extra = "allow"


class SeerRunState(BaseModel):
    """State of a Seer Explorer session."""

    run_id: int
    blocks: list[MemoryBlock]
    status: Literal["processing", "completed", "error", "awaiting_user_input"]
    updated_at: str
    pending_user_input: PendingUserInput | None = None

    class Config:
        extra = "allow"

    def get_artifacts(self) -> dict[str, Artifact]:
        """
        Scan blocks and return the latest artifact for each key.

        Returns:
            Dict mapping artifact keys to their latest Artifact
        """
        result: dict[str, Artifact] = {}
        for block in self.blocks:
            for artifact in block.artifacts:
                result[artifact.key] = artifact
        return result

    def get_artifact(self, key: str, schema: type[T]) -> T | None:
        """
        Get a typed artifact by key.

        Args:
            key: The artifact key
            schema: The Pydantic model class to parse the artifact data into

        Returns:
            The parsed artifact as a typed Pydantic model, or None if not found or not yet generated
        """
        artifacts = self.get_artifacts()
        artifact = artifacts.get(key)
        if artifact is None or artifact.data is None:
            return None
        return schema.parse_obj(artifact.data)


class CustomToolDefinition(BaseModel):
    """Definition of a custom tool to be sent to Seer."""

    name: str
    module_path: str
    description: str
    parameters: list[dict[str, Any]]
    required: list[str]


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
