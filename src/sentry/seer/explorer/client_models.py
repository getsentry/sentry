"""
Pydantic models for Seer Explorer client.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypeVar

from pydantic import BaseModel, Field

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


class FilePatch(BaseModel):
    """A file patch from code editing."""

    path: str
    type: Literal["A", "M", "D"]  # A=add, M=modify, D=delete
    added: int
    removed: int

    class Config:
        extra = "allow"


class ExplorerFilePatch(BaseModel):
    """A file patch associated with a repository."""

    repo_name: str
    patch: FilePatch

    class Config:
        extra = "allow"


class RepoPRState(BaseModel):
    """PR state for a single repository."""

    repo_name: str
    branch_name: str | None = None
    pr_number: int | None = None
    pr_url: str | None = None
    pr_id: int | None = None
    commit_sha: str | None = None
    pr_creation_status: Literal["creating", "completed", "error"] | None = None
    pr_creation_error: str | None = None
    title: str | None = None
    description: str | None = None

    class Config:
        extra = "allow"


class MemoryBlock(BaseModel):
    """A block in the Explorer agent's conversation/memory."""

    id: str
    message: Message
    timestamp: str
    loading: bool = False
    artifacts: list[Artifact] = []
    file_patches: list[ExplorerFilePatch] | None = None  # Incremental patches (per edit)
    merged_file_patches: list[ExplorerFilePatch] | None = (
        None  # Unified patches (original → current) for files touched in this block; merges all file_patches for a given file across all blocks into a single patch
    )
    pr_commit_shas: dict[str, str] | None = (
        None  # repository name -> commit SHA. Used to track which commit was associated with each repo's PR at the time this block was created.
    )

    class Config:
        extra = "allow"


class PendingUserInput(BaseModel):
    """A pending user input request from the agent."""

    id: str
    input_type: str
    data: dict[str, Any]

    class Config:
        extra = "allow"


class CodingAgentResult(BaseModel):
    """Result from a coding agent."""

    description: str
    repo_provider: str
    repo_full_name: str
    branch_name: str | None = None
    pr_url: str | None = None

    class Config:
        extra = "allow"


class ExplorerCodingAgentState(BaseModel):
    """State of a coding agent launched from an Explorer run."""

    id: str
    status: Literal["pending", "running", "completed", "failed"]
    agent_url: str | None = None
    provider: str  # e.g., "cursor_background_agent"
    name: str
    started_at: datetime
    results: list[CodingAgentResult] = Field(default_factory=list)

    class Config:
        extra = "allow"


class SeerRunState(BaseModel):
    """State of a Seer Explorer session."""

    run_id: int
    blocks: list[MemoryBlock]
    status: Literal["processing", "completed", "error", "awaiting_user_input"]
    updated_at: str
    pending_user_input: PendingUserInput | None = None
    repo_pr_states: dict[str, RepoPRState] = Field(default_factory=dict)
    metadata: dict[str, Any] | None = None
    coding_agents: dict[str, ExplorerCodingAgentState] = Field(default_factory=dict)

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

    def get_diffs_by_repo(self) -> dict[str, list[ExplorerFilePatch]]:
        """
        Get the latest merged diff for each file, grouped by repository.
        Each patch represents the sum of all edits made to a file throughout the run.
        """
        # Collect latest merged patch per (repo, path)
        merged_by_file: dict[tuple[str, str], ExplorerFilePatch] = {}
        for block in self.blocks:
            for fp in block.merged_file_patches or []:
                key = (fp.repo_name, fp.patch.path)
                merged_by_file[key] = fp

        # Group by repo
        by_repo: dict[str, list[ExplorerFilePatch]] = {}
        for fp in merged_by_file.values():
            if fp.repo_name not in by_repo:
                by_repo[fp.repo_name] = []
            by_repo[fp.repo_name].append(fp)
        return by_repo

    def get_pr_state(self, repo_name: str) -> RepoPRState | None:
        """Get PR state for a specific repository."""
        return self.repo_pr_states.get(repo_name)

    def _is_repo_synced(self, repo_name: str) -> bool:
        """Check if PR for a repo is in sync with latest changes."""
        pr_state = self.repo_pr_states.get(repo_name)
        if not pr_state or not pr_state.commit_sha:
            return False  # No PR yet = not synced

        # Find last block with merged patches for this repo
        for block in reversed(self.blocks):
            if any(fp.repo_name == repo_name for fp in (block.merged_file_patches or [])):
                block_sha = (block.pr_commit_shas or {}).get(repo_name)
                return block_sha == pr_state.commit_sha
        return True  # No patches found = synced

    def has_code_changes(self) -> tuple[bool, bool]:
        """
        Check if there are code changes and if all have been pushed to PRs.

        Returns:
            (has_changes, all_changes_pushed):
            - has_changes: True if any file patches exist
            - all_changes_pushed: True if the current state of changes across all repos have all been pushed to PRs.
        """
        diffs_by_repo = self.get_diffs_by_repo()
        has_changes = len(diffs_by_repo) > 0

        if not has_changes:
            return (False, True)

        # Check if all repos with changes are synced
        all_changes_pushed = all(self._is_repo_synced(repo) for repo in diffs_by_repo.keys())
        return (has_changes, all_changes_pushed)


class CustomToolDefinition(BaseModel):
    """Definition of a custom tool to be sent to Seer."""

    name: str
    module_path: str
    description: str
    param_schema: dict[str, Any]  # JSON schema from Pydantic model


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
