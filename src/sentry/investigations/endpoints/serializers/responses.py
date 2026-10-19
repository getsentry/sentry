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


# The orchestration projection's nested shapes mirror the contract serializers in
# `sentry.investigations.contracts`, which validate every projection Seer sends.
# Each is relaxed, so a projection may carry fields Seer added after these.


class InvestigationProjectionErrorResponse(TypedDict):
    code: str
    message: str
    retryable: NotRequired[bool]
    source: NotRequired[str | None]
    occurredAt: NotRequired[str | None]


class InvestigationToolActivityResponse(TypedDict):
    id: str
    title: str
    kind: str
    status: str


class InvestigationEvidenceResponse(TypedDict):
    id: str
    title: str
    kind: str
    reference: NotRequired[str | None]
    url: NotRequired[str | None]
    summary: NotRequired[str | None]
    data: NotRequired[dict[str, Any]]
    projectIds: NotRequired[list[int] | None]
    useInvestigationProjectScope: NotRequired[bool]


class InvestigationAgentVerdictResponse(TypedDict):
    verdict: str
    confidence: float
    rationale: str
    supportingEvidenceIds: NotRequired[list[str]]
    refutingEvidenceIds: NotRequired[list[str]]
    remainingGaps: NotRequired[list[str]]
    decidedAt: NotRequired[str | None]


class InvestigationVerificationStepResponse(TypedDict):
    id: str
    order: int
    title: str
    objective: str
    method: str
    status: str
    result: NotRequired[str | None]
    evidence: NotRequired[list[InvestigationEvidenceResponse]]
    error: NotRequired[InvestigationProjectionErrorResponse | None]


class InvestigationUserDispositionResponse(TypedDict):
    disposition: str
    userId: NotRequired[int | None]
    decidedAt: NotRequired[str | None]


class InvestigationHypothesisResponse(TypedDict):
    id: str
    order: int
    statement: str
    rationale: str
    status: str
    effectiveStatus: str
    decisionSource: str
    confidence: NotRequired[float | None]
    generation: NotRequired[int]
    attempt: NotRequired[int]
    automaticRetryCount: NotRequired[int]
    investigatorRunId: NotRequired[int | None]
    planningStatus: NotRequired[str]
    heartbeatAt: NotRequired[str | None]
    toolActivity: NotRequired[list[InvestigationToolActivityResponse]]
    evidence: NotRequired[list[InvestigationEvidenceResponse]]
    verificationSteps: NotRequired[list[InvestigationVerificationStepResponse]]
    agentVerdict: NotRequired[InvestigationAgentVerdictResponse | None]
    userDisposition: NotRequired[InvestigationUserDispositionResponse | None]
    error: NotRequired[InvestigationProjectionErrorResponse | None]


class InvestigationBroadScanResponse(TypedDict):
    status: str
    summary: NotRequired[str | None]
    heartbeatAt: NotRequired[str | None]
    error: NotRequired[InvestigationProjectionErrorResponse | None]
    toolActivity: NotRequired[list[InvestigationToolActivityResponse]]
    generation: NotRequired[int]
    attempt: NotRequired[int]
    automaticRetryCount: NotRequired[int]
    runId: NotRequired[int | None]


class InvestigationReportClearIntentResponse(TypedDict):
    id: str
    revision: int
    reason: str
    requestedAt: NotRequired[str | None]
    completed: NotRequired[bool]


class InvestigationReportMetadataResponse(TypedDict):
    status: str
    title: NotRequired[str | None]
    summary: NotRequired[str | None]
    summaryDescription: NotRequired[str | None]
    titleStatus: NotRequired[str]
    automaticRetryCount: NotRequired[int]
    error: NotRequired[InvestigationProjectionErrorResponse | None]


class InvestigationSuggestedHypothesisResponse(TypedDict):
    statement: str
    rationale: str


class InvestigationReportResponse(TypedDict):
    status: str
    revision: int
    notebookRevision: int
    metadata: InvestigationReportMetadataResponse
    includedHypothesisIds: NotRequired[list[str]]
    primaryHypothesisId: NotRequired[str | None]
    currentBlockKey: NotRequired[str | None]
    currentBlockStatus: NotRequired[str]
    currentBlockToolActivity: NotRequired[list[InvestigationToolActivityResponse]]
    heartbeatAt: NotRequired[str | None]
    automaticRetryCount: NotRequired[int]
    clearIntent: NotRequired[InvestigationReportClearIntentResponse | None]
    suggestedHypotheses: NotRequired[list[InvestigationSuggestedHypothesisResponse]]
    error: NotRequired[InvestigationProjectionErrorResponse | None]


class InvestigationPendingInputResponse(TypedDict):
    prompt: str
    missingFields: NotRequired[list[str]]


class InvestigationSchedulingResponse(TypedDict):
    maxConcurrency: NotRequired[int]
    availableSlots: NotRequired[int]
    activeHypothesisIds: NotRequired[list[str]]
    queuedHypothesisIds: NotRequired[list[str]]
    nextHypothesisIds: NotRequired[list[str]]


class InvestigationCancellationIntentResponse(TypedDict):
    id: str
    scope: str
    generation: int
    reason: str
    targetId: NotRequired[str | None]
    childRunId: NotRequired[int | None]
    requestedAt: NotRequired[str | None]
    completed: NotRequired[bool]


class InvestigationSteeringIntentResponse(TypedDict):
    id: str
    requestId: str
    instruction: str
    target: str
    targetId: NotRequired[str | None]
    createdAt: NotRequired[str | None]
    completed: NotRequired[bool]


class InvestigationOrchestrationResponse(TypedDict):
    """Seer-owned workflow projection overlaid with Sentry's authoritative run fields."""

    runId: str | None
    investigationId: str
    sourceType: str
    workflowVersion: int
    generation: int
    phase: str
    status: str
    notebookRevision: int
    broadScan: InvestigationBroadScanResponse
    hypotheses: list[InvestigationHypothesisResponse]
    report: InvestigationReportResponse
    pendingInput: InvestigationPendingInputResponse | None
    errors: list[InvestigationProjectionErrorResponse]
    heartbeatAt: datetime | None
    updatedAt: datetime
    serverTime: datetime
    startedAt: NotRequired[str | None]
    finishedAt: NotRequired[str | None]
    activeSince: NotRequired[str | None]
    activeTimeElapsedSeconds: NotRequired[float | None]
    investigatorScheduling: NotRequired[InvestigationSchedulingResponse | None]
    cancellationIntents: NotRequired[list[InvestigationCancellationIntentResponse]]
    steeringIntents: NotRequired[list[InvestigationSteeringIntentResponse]]


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
