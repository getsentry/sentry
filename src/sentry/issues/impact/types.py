from __future__ import annotations

from typing import Final, Literal, TypedDict

from pydantic import BaseModel, Field

IMPACT_FEATURE_ID: Final = "impact_assessment"

ImpactLevel = Literal["super_low", "low", "moderate", "high", "super_high"]


class ImpactCitationData(TypedDict):
    reference: str
    claim: str
    source: str


class AvailableImpactCitation(TypedDict):
    reference: str
    source: str


class ImpactDerivedData(TypedDict):
    score: float | None
    level: ImpactLevel | None
    description: str
    citations: list[ImpactCitationData]
    sourceEventId: str


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
