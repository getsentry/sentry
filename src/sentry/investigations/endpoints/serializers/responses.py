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


class InvestigationOrchestrationResponse(TypedDict):
    """Seer-owned workflow projection overlaid with Sentry's authoritative run fields. The nested broadScan, hypotheses, report, pendingInput, and errors objects follow Seer's contract and may carry fields Sentry does not declare."""

    runId: str | None
    investigationId: str
    sourceType: str
    workflowVersion: int
    generation: int
    phase: str
    status: str
    notebookRevision: int
    broadScan: dict[str, Any]
    hypotheses: list[dict[str, Any]]
    report: dict[str, Any]
    pendingInput: dict[str, Any] | None
    errors: list[dict[str, Any]]
    heartbeatAt: datetime | None
    updatedAt: datetime
    serverTime: datetime
    startedAt: NotRequired[str | None]
    finishedAt: NotRequired[str | None]
    activeSince: NotRequired[str | None]
    activeTimeElapsedSeconds: NotRequired[float | None]
    investigatorScheduling: NotRequired[dict[str, Any] | None]
    cancellationIntents: NotRequired[list[dict[str, Any]]]
    steeringIntents: NotRequired[list[dict[str, Any]]]


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
