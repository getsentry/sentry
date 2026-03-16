from __future__ import annotations

from pydantic import BaseModel


class GithubCopilotTaskRequest(BaseModel):
    """Request body for POST /repos/{owner}/{repo}/tasks"""

    problem_statement: str
    event_content: str | None = None
    model: str | None = None
    create_pull_request: bool = True
    base_ref: str | None = None
    event_type: str = "sentry"


class GithubCopilotArtifactData(BaseModel):
    """Data for an artifact - structure varies by type"""

    id: int | None = None
    type: str | None = None  # 'pull', 'issue', etc.
    global_id: str | None = None
    # Branch artifact fields
    head_ref: str | None = None
    base_ref: str | None = None


class GithubCopilotArtifact(BaseModel):
    """Artifact created by a task (PR, branch, etc.)"""

    provider: str | None = None
    type: str | None = None  # 'github_resource', 'branch', etc.
    data: GithubCopilotArtifactData | None = None


class GithubCopilotSession(BaseModel):
    """A session within a task"""

    id: str
    name: str | None = None
    state: str | None = None  # queued, in_progress, completed, failed, timed_out
    user_id: int | None = None
    agent_id: int | None = None
    agent_type: str | None = None
    resource_type: str | None = None
    resource_id: int | None = None
    resource_global_id: str | None = None
    last_updated_at: str | None = None
    created_at: str | None = None
    completed_at: str | None = None
    event_type: str | None = None
    event_identifiers: list[str] | None = None
    event_content: str | None = None
    error: dict[str, str] | None = None
    head_ref: str | None = None
    base_ref: str | None = None


class GithubCopilotAgentCollaborator(BaseModel):
    agent_type: str | None = None
    agent_id: int | None = None
    agent_task_id: str | None = None


class GithubCopilotTask(BaseModel):
    """Task object returned inside API responses."""

    id: str
    name: str | None = None
    creator_id: int | None = None
    user_collaborators: list[int] | None = None
    agent_collaborators: list[GithubCopilotAgentCollaborator] | None = None
    owner_id: int | None = None
    repo_id: int | None = None
    status: str | None = None  # queued, in_progress, completed, failed, timed_out
    session_count: int | None = None
    artifacts: list[GithubCopilotArtifact] | None = None
    archived_at: str | None = None
    last_updated_at: str | None = None
    created_at: str | None = None
    sessions: list[GithubCopilotSession] | None = None


class GithubCopilotTaskResponse(BaseModel):
    """
    Response from GitHub Copilot Tasks API.
    The API wraps the task object in a {"task": {...}} envelope.
    """

    task: GithubCopilotTask


class GithubPRFromGraphQL(BaseModel):
    """PR info fetched from GitHub GraphQL API"""

    number: int
    title: str
    url: str
