"""Wire types for the smart_assignment feature, in sync with Seer's
seer.automation.features.smart_assignment.models. Covers both the request payload
(Sentry -> Seer) and the result artifact (Seer -> Sentry).

Fields Sentry doesn't switch on (`signals`, `confidence`) are typed as plain
strings rather than mirroring Seer's Literals on purpose: this is a cross-service
contract, and loosening them here means Seer adding a new signal source or
confidence level can't make an otherwise-valid artifact fail to parse. `reason`
and `confidence` are defaulted so a minimal-but-valid candidate (one that at least
names someone) still round-trips.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class _Base(BaseModel):
    class Config:
        extra = "ignore"


# Request payload (Sentry -> Seer): the `payload` block of the feature run.


class SmartAssignmentPayload(_Base):
    group_id: int
    project_slug: str | None = None


# Result payload (Seer -> Sentry): the ranked verdict pushed back.


class RankedCandidate(_Base):
    identifier: str
    # How to resolve `identifier`: "username" (a linked Sentry user's @handle) or
    # "email" (a raw commit email). Unlike `signals`/`confidence` above, this IS a
    # field we switch on, so we mirror Seer's Literal exactly (rather than loosening
    # it) -- an unexpected kind should fail loudly at parse time, not silently
    # resolve to no user.
    identifier_kind: Literal["email", "username"]
    reason: str = ""
    signals: list[str] = Field(default_factory=list)
    confidence: str = ""


class AssigneeVerdict(_Base):
    """The artifact Seer delivers: ranked best-first, empty == no confident pick."""

    candidates: list[RankedCandidate] = Field(default_factory=list)
