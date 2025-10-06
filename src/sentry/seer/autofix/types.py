from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from sentry.seer.autofix.constants import AutofixStatus


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint"""

    run_id: int


class CommittedPullRequestDetails(TypedDict):
    pr_number: int
    pr_url: str
    pr_id: NotRequired[int | None]


class AutofixIssueDict(TypedDict):
    id: int
    title: str


class AutofixRequestDict(TypedDict):
    organization_id: int
    project_id: int
    issue: AutofixIssueDict


class FileChangeDict(TypedDict):
    path: str
    content: NotRequired[str | None]
    is_deleted: NotRequired[bool]


class CodebaseStateDict(TypedDict):
    repo_external_id: NotRequired[str | None]
    file_changes: NotRequired[list[FileChangeDict]]
    is_readable: NotRequired[bool | None]
    is_writeable: NotRequired[bool | None]


class CodingAgentResultDict(TypedDict):
    description: str
    repo_provider: str
    repo_full_name: str
    branch_name: NotRequired[str | None]
    pr_url: NotRequired[str | None]


class CodingAgentStateDict(TypedDict):
    id: str
    status: str
    agent_url: NotRequired[str | None]
    provider: str
    name: str
    started_at: str
    results: NotRequired[list[CodingAgentResultDict]]


class RepositoryDict(TypedDict):
    external_id: str
    name: str
    provider: str | None
    default_branch: str | None
    is_readable: bool | None
    is_writeable: bool | None


class AutofixStateDict(TypedDict):
    """This payload may change in the future, the documented fields here are are not fully inclusive of all fields that are returned."""

    run_id: int
    request: AutofixRequestDict
    updated_at: str
    status: AutofixStatus
    codebases: NotRequired[dict[str, CodebaseStateDict]]
    steps: NotRequired[list[dict]]
    coding_agents: NotRequired[dict[str, CodingAgentStateDict]]
    users: NotRequired[dict[str, Any]]
    repositories: NotRequired[list[RepositoryDict]]


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: AutofixStateDict | None
