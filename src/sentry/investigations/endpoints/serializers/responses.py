from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry.investigations.endpoints.serializers.investigation import (
    InvestigationOrchestrationSerializerResponse,
)


class InvestigationExecutionResponse(TypedDict):
    """Execution accepted for asynchronous processing; poll its detail endpoint."""

    id: str
    status: str


class InvestigationExecutionDetailsResponse(InvestigationExecutionResponse):
    """Agent transcript and pending input are Seer-owned JSON payloads. Partial Markdown is available for text blocks while they run."""

    blocks: list[dict[str, Any]]
    transcriptTruncated: bool
    pendingUserInput: dict[str, Any] | None
    partialMarkdown: str | None
    error: Any


class InvestigationCommandResponse(TypedDict):
    """Command acceptance, not completion. Projection is the current Seer workflow state; runId may be null before dispatch."""

    runId: str | None
    requestId: str
    accepted: bool
    duplicate: bool
    workflowVersion: int
    commandStatus: str
    commandError: dict[str, Any] | None
    projection: dict[str, Any]


class InvestigationCandidateResponse(TypedDict):
    status: str
    investigationId: NotRequired[str]
    orchestration: NotRequired[InvestigationOrchestrationSerializerResponse]


class InvestigationCandidatesResponse(TypedDict):
    items: list[InvestigationCandidateResponse]


class InvestigationViewerResponse(TypedDict):
    userId: str
    lastSeen: datetime
    active: bool


class InvestigationPresenceResponse(TypedDict):
    viewers: list[InvestigationViewerResponse]
    total: int
    heartbeatIntervalMs: int


class InvestigationTitlePreviewResponse(TypedDict):
    status: str | None
    preview: str | None
