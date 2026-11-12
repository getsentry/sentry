from datetime import datetime
from typing import Any, TypedDict

from sentry.notebooks.endpoints.serializers.action_request import (
    NotebookActionRequestSerializerResponse,
)


class NotebookViewerResponse(TypedDict):
    userId: str
    lastSeen: datetime
    active: bool


class NotebookPresenceResponse(TypedDict):
    viewers: list[NotebookViewerResponse]
    total: int
    heartbeatIntervalMs: int


class NotebookExecutionResponse(TypedDict):
    """Execution accepted for asynchronous processing; poll its detail endpoint."""

    id: str
    status: str


class NotebookExecutionDetailsResponse(NotebookExecutionResponse):
    """Agent transcript and pending input are Seer-owned JSON payloads. Partial Markdown is available for text blocks while they run."""

    blocks: list[dict[str, Any]]
    transcriptTruncated: bool
    pendingUserInput: dict[str, Any] | None
    partialMarkdown: str | None
    error: Any


class NotebookTitlePreviewResponse(TypedDict):
    status: str | None
    preview: str | None


class NotebookActionRequestApplyResponse(TypedDict):
    actionRequest: NotebookActionRequestSerializerResponse


class NotebookActionRequestRecheckResponse(TypedDict):
    actionRequest: NotebookActionRequestSerializerResponse


class NotebookActionRequestRetryFollowUpResponse(TypedDict):
    actionRequest: NotebookActionRequestSerializerResponse
