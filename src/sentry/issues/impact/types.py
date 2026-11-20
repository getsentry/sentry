from __future__ import annotations

from typing import Annotated, Any, Final, Literal, TypedDict

from pydantic import BaseModel, Field, StrictFloat, StrictInt, StrictStr

from sentry.apidocs.descriptions import ApiDescription

IMPACT_FEATURE_ID: Final = "impact_assessment"
TYPED_CITATIONS_FEATURE: Final = "organizations:seer-impact-typed-citations"
# Version 2 lets Seer cite whatever its tools read, by citation id (sentry.seer.citations).
TYPED_CITATION_CONTRACT_VERSION: Final = 2

ImpactLevel = Literal["super_low", "low", "moderate", "high", "super_high"]


def get_impact_level(score: float | None) -> ImpactLevel | None:
    if score is None:
        return None
    if score < 20:
        return "super_low"
    if score < 40:
        return "low"
    if score < 60:
        return "moderate"
    if score < 80:
        return "high"
    return "super_high"


class ImpactCitationData(TypedDict):
    reference: Annotated[
        str, ApiDescription("Stable identifier for the evidence supporting this claim")
    ]
    claim: Annotated[
        str, ApiDescription("Concise explanation of what the cited evidence establishes")
    ]
    source: Annotated[
        str,
        ApiDescription("The category of evidence cited, such as an event, trace, replay, or log"),
    ]


class ImpactClaimData(TypedDict):
    claim: Annotated[str, ApiDescription("One specific statement about the user impact")]
    citationIds: Annotated[
        list[str], ApiDescription("IDs of the entries in `evidence` that establish the claim")
    ]


class AvailableImpactCitation(TypedDict):
    reference: str
    source: str


class ImpactDerivedData(TypedDict):
    score: Annotated[
        float | None,
        ApiDescription(
            "Estimated per-occurrence impact on the end user's capability from 0 to 100"
        ),
    ]
    level: Annotated[
        ImpactLevel | None, ApiDescription("Impact level derived from the assessment score")
    ]
    description: Annotated[
        str, ApiDescription("Human-readable description of the capability affected by the issue")
    ]
    citations: Annotated[
        list[ImpactCitationData],
        ApiDescription("Evidence-backed claims supporting the impact assessment"),
    ]
    sourceEventId: Annotated[
        str, ApiDescription("ID of the issue event used to generate the impact assessment")
    ]
    claims: Annotated[
        list[ImpactClaimData],
        ApiDescription("Claims the assessment rests on, each citing entries in `evidence`"),
    ]
    evidence: Annotated[
        list[dict[str, Any]],
        ApiDescription(
            "Typed citations (an event frame, span, log line, replay moment, query result, ...) "
            "backing the claims"
        ),
    ]


# See assess_impact_for_group(), these citations should be stable references to details pulled from
# the event itself that were supplied to the agent, that way we can reverse them and display them
# as rich embeds alongside the impact assessment.
class ImpactCitation(BaseModel):
    reference: str = Field(
        min_length=1,
        max_length=128,
        description="Stable identifier for the evidence supporting this claim.",
    )
    claim: str = Field(
        min_length=1,
        max_length=2_000,
        description="Concise explanation of what the cited evidence establishes.",
    )
    source: str = Field(
        min_length=1,
        max_length=64,
        description="The category of evidence cited, such as an event, trace, replay, or log.",
    )


class ProjectImpactContext(BaseModel):
    description: str = Field(
        min_length=1,
        max_length=4_000,
        description="Customer-provided context about the project's user-facing purpose.",
    )


# Keep these Seer response models in sync with the corresponding contract in Seer.
class SeerImpactAssessmentResponse(BaseModel):
    score: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description=(
            "Estimated per-occurrence impact on the end user's capability from 0 to 100. "
            "This does not measure reach, frequency, urgency, or priority."
        ),
    )
    description: str = Field(
        min_length=1,
        max_length=2_000,
        description="Human-readable description of the capability affected by the issue.",
    )
    citations: list[ImpactCitation] = Field(
        min_items=1,
        max_items=16,
        description="Citations selected from the available citation catalog.",
    )


class ImpactClaim(BaseModel):
    claim: str = Field(min_length=1, max_length=1_000)
    citation_ids: list[str] = Field(min_items=1, max_items=8)


class SeerImpactClaim(BaseModel):
    claim: str = Field(min_length=1, max_length=1_000)
    citationIds: list[str] = Field(min_items=1, max_items=8)


class SeerImpactAssessmentResponseV2(BaseModel):
    """The citation contract version 2 result: claims citing Seer's typed citations by id."""

    score: float | None = Field(default=None, ge=0, le=100)
    description: str = Field(min_length=1, max_length=2_000)
    claims: list[SeerImpactClaim] = Field(min_items=1, max_items=12)
    # Validated separately by sentry.seer.citations; never trusted as-is.
    citations: list[Any] = Field(default_factory=list, max_items=128)


def legacy_citations(
    claims: list[ImpactClaim], evidence: list[StoredCitation]
) -> list[ImpactCitation]:
    """Version 1 citations for a version 2 assessment, so older clients still render it."""
    by_id = {citation.id: citation for citation in evidence}
    return [
        ImpactCitation(
            claim=claim.claim,
            reference=claim.citation_ids[0],
            source=by_id[claim.citation_ids[0]].kind,
        )
        for claim in claims
        if claim.citation_ids and claim.citation_ids[0] in by_id
    ]


# Stored form of a validated citation (see sentry.seer.citations). Action log payloads
# must be typed, so the per-kind locators are flattened into one model of optional
# fields. tests/sentry/issues/impact/test_types.py keeps it in step with
# citations.generated.json.
CitationKind = Literal[
    "issue",
    "event",
    "trace",
    "log",
    "replay",
    "profile",
    "query",
    "feedback",
    "code",
    "commit",
    "pullRequest",
    "external",
]


class CitationIssueStat(BaseModel):
    name: Literal["users", "events", "firstSeen", "lastSeen"]
    value: StrictInt | StrictFloat | StrictStr


class CitationEventFocus(BaseModel):
    type: Literal["frame", "tag", "breadcrumb", "context"]
    exceptionIndex: int | None = None
    frameIndex: int | None = None
    function: str | None = None
    filename: str | None = None
    lineNo: int | None = None
    key: str | None = None
    value: str | None = None
    index: int | None = None


class CitationLocator(BaseModel):
    groupId: str | None = None
    shortId: str | None = None
    stat: CitationIssueStat | None = None
    eventId: str | None = None
    focus: CitationEventFocus | None = None
    traceId: str | None = None
    spanId: str | None = None
    logId: str | None = None
    timestamp: str | None = None
    replayId: str | None = None
    offsetMs: int | None = None
    profileId: str | None = None
    projectSlug: str | None = None
    function: str | None = None
    dataset: str | None = None
    query: str | None = None
    fields: list[str] | None = None
    yAxes: list[str] | None = None
    groupBy: list[str] | None = None
    projects: list[str] | None = None
    statsPeriod: str | None = None
    start: str | None = None
    end: str | None = None
    resultSummary: str | None = None
    feedbackId: str | None = None
    repo: str | None = None
    path: str | None = None
    ref: str | None = None
    startLine: int | None = None
    endLine: int | None = None
    sha: str | None = None
    number: int | None = None
    url: str | None = None
    source: str | None = None


class StoredCitation(BaseModel):
    id: str
    kind: CitationKind
    title: str
    locator: CitationLocator
    excerpt: str | None = None
    observedAt: str | None = None
    projectId: str | None = None
    url: str | None = None

    def to_api(self) -> dict[str, Any]:
        return self.dict(exclude_none=True)
