from datetime import datetime
from typing import Any, TypedDict


class InvestigationViewerResponse(TypedDict):
    userId: str
    lastSeen: datetime
    active: bool


class InvestigationPresenceResponse(TypedDict):
    viewers: list[InvestigationViewerResponse]
    total: int
    heartbeatIntervalMs: int


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


class InvestigationTitlePreviewResponse(TypedDict):
    status: str | None
    preview: str | None
