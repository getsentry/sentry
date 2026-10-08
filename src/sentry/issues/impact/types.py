from __future__ import annotations

from pydantic import BaseModel, Field

MAX_CONTEXT_LINES = 3
MAX_EVIDENCE_ITEMS = 16
MAX_FRAMES = 16
MAX_IMPACT_INPUT_BYTES = 128 * 1024


class ImpactException(BaseModel):
    """Exception details supplied as evidence to an Impact assessor."""

    type: str | None = None
    value: str | None = None


class ImpactFrame(BaseModel):
    """Bounded in-app frame context supplied as evidence to an Impact assessor."""

    id: str
    function: str | None = None
    filename: str | None = None
    module: str | None = None
    in_app: bool = True
    pre_context: list[str] = Field(default_factory=list, max_items=MAX_CONTEXT_LINES)
    context_line: str | None = None
    post_context: list[str] = Field(default_factory=list, max_items=MAX_CONTEXT_LINES)


class ImpactTraceContext(BaseModel):
    """Allowlisted trace context that helps an assessor identify the failed operation."""

    op: str | None = None
    status: str | None = None
    description: str | None = None


class ImpactEvidenceItem(BaseModel):
    """Human-readable Issue Platform evidence included without its raw detector payload."""

    name: str
    value: str


class ImpactOccurrenceEvidence(BaseModel):
    """Normalized evidence describing what happened during one issue occurrence."""

    title: str
    subtitle: str | None = None
    exception: ImpactException | None = None
    culprit: str | None = None
    transaction: str | None = None
    url: str | None = None
    platform: str | None = None
    environment: str | None = None
    release: str | None = None
    mechanism: str | None = None
    handled: bool | None = None
    frames: list[ImpactFrame] = Field(default_factory=list, max_items=MAX_FRAMES)
    component_stack: list[str] = Field(default_factory=list, max_items=MAX_EVIDENCE_ITEMS)
    trace: ImpactTraceContext | None = None
    replay_available: bool = False
    evidence: list[ImpactEvidenceItem] = Field(default_factory=list, max_items=MAX_EVIDENCE_ITEMS)
    evidence_ids: list[str] = Field(default_factory=list)


class ProjectImpactContext(BaseModel):
    """Customer-provided project description used to interpret technical evidence."""

    description: str


class ImpactAssessmentInput(BaseModel):
    """Fingerprint-stable input shared by all Impact assessors."""

    issue_evidence: ImpactOccurrenceEvidence
    project_context: ProjectImpactContext | None = None
    fingerprint: str = Field(min_length=64, max_length=64)
