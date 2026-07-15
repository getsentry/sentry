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

from django.db import models
from pydantic import BaseModel, Field

from sentry.types.activity import ActivityType

# feature_id this feature is registered under on the Seer side; also the
# SeerAgentRun.source of its run mirrors, so it's the key we dedup/look up runs by.
FEATURE_ID = "smart_assignment"


# Resolutions we treat as ground truth: a human resolving an issue is a signal for
# who should have owned it.
# SET_RESOLVED_BY_AGE is excluded (auto-resolve cron, no acting user, so no signal).
RESOLUTION_ACTIVITIES = frozenset(
    {
        ActivityType.SET_RESOLVED,
        ActivityType.SET_RESOLVED_IN_RELEASE,
        ActivityType.SET_RESOLVED_IN_COMMIT,
        ActivityType.SET_RESOLVED_IN_PULL_REQUEST,
    }
)


class SmartAssignmentScore(models.TextChoices):
    """How a delivered prediction scored against the observed ground truth.

    Coarse live signal (emitted as the `smart_assignment.scored` metric) with
    partial credit for landing on the right team; the authoritative verdict/run
    content lives in Seer.
    """

    EXACT = "exact"  # predicted user is the actual assignee
    TEAM = "team"  # predicted user isn't the assignee but is on the correct team
    MISS = "miss"  # neither


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
