from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict, Union

from sentry.seer.autofix.constants import AutofixStatus


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint"""

    run_id: int


class ProgressItem(TypedDict):
    timestamp: str
    message: str
    type: Literal["INFO", "WARNING", "ERROR", "NEED_MORE_INFORMATION", "USER_RESPONSE"]
    data: NotRequired[Any]


class CommentThread(TypedDict):
    id: str
    messages: NotRequired[list[dict[str, Any]]]
    is_completed: NotRequired[bool]
    selected_text: NotRequired[str | None]


class InsightSharingOutput(TypedDict):
    insight: str
    justification: NotRequired[str]


class BaseStepDict(TypedDict):
    id: str
    key: NotRequired[str | None]
    title: str
    type: str
    status: str
    index: int
    progress: NotRequired[list[ProgressItem | StepDict]]
    completedMessage: NotRequired[str | None]
    output_stream: NotRequired[str | None]


class DefaultStepDict(BaseStepDict):
    type: Literal["default"]
    insights: NotRequired[list[InsightSharingOutput]]
    initial_memory_length: NotRequired[int]


class TimelineEvent(TypedDict):
    title: str
    description: NotRequired[str]


class RootCauseAnalysisItem(TypedDict):
    id: int
    title: str
    description: str
    code_context: NotRequired[list[dict[str, Any]]]
    root_cause_reproduction: NotRequired[list[TimelineEvent]]


class CustomRootCauseSelection(TypedDict):
    custom_root_cause: str


class CodeContextRootCauseSelection(TypedDict):
    cause_id: int
    instruction: NotRequired[str | None]


RootCauseSelection = Union[CustomRootCauseSelection, CodeContextRootCauseSelection]


class RootCauseStepDict(BaseStepDict):
    type: Literal["root_cause_analysis"]
    causes: NotRequired[list[RootCauseAnalysisItem]]
    selection: NotRequired[RootCauseSelection | None]
    termination_reason: NotRequired[str | None]


class SolutionTimelineEvent(TypedDict):
    title: str
    description: NotRequired[str]


class SolutionStepDict(BaseStepDict):
    type: Literal["solution"]
    solution: NotRequired[list[SolutionTimelineEvent]]
    description: NotRequired[str | None]
    custom_solution: NotRequired[str | None]
    solution_selected: NotRequired[bool]
    selected_mode: NotRequired[Literal["all", "fix", "test"] | None]


class FilePatch(TypedDict):
    path: str
    added: NotRequired[int]
    removed: NotRequired[int]
    source_file: NotRequired[str]
    target_file: NotRequired[str]
    type: NotRequired[str]
    hunks: NotRequired[list[dict[str, Any]]]


class CommittedPullRequestDetails(TypedDict):
    pr_number: int
    pr_url: str
    pr_id: NotRequired[int | None]


class CodebaseChange(TypedDict):
    repo_external_id: NotRequired[str | None]
    repo_name: str
    title: str
    description: str
    diff: NotRequired[list[FilePatch]]
    diff_str: NotRequired[str | None]
    draft_branch_name: NotRequired[str | None]
    branch_name: NotRequired[str | None]
    pull_request: NotRequired[CommittedPullRequestDetails | None]


class ChangesStepDict(BaseStepDict):
    type: Literal["changes"]
    changes: NotRequired[list[CodebaseChange]]
    termination_reason: NotRequired[str | None]


StepDict = Union[DefaultStepDict, RootCauseStepDict, SolutionStepDict, ChangesStepDict]


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
    integration_id: int | None
    url: str | None
    external_id: str
    name: str
    provider: str | None
    default_branch: str | None
    is_readable: bool | None
    is_writeable: bool | None


class AutofixStateDict(TypedDict):
    """Serialized autofix state returned in the GET response"""

    run_id: int
    request: AutofixRequestDict
    updated_at: str
    status: AutofixStatus
    actor_ids: NotRequired[list[str] | None]
    codebases: NotRequired[dict[str, CodebaseStateDict]]
    steps: NotRequired[list[StepDict]]
    coding_agents: NotRequired[dict[str, CodingAgentStateDict]]
    users: NotRequired[dict[str, Any]]
    repositories: NotRequired[list[RepositoryDict]]


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: AutofixStateDict | None
