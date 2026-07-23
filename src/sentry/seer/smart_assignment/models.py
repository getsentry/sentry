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

# SeerAgentRun.source, the key we dedup/look up runs by.
SEER_FEATURE_ID = "smart_assignment"


# Resolutions we treat as ground truth: a human resolving an issue is a signal for
# who should have owned it.
# SET_RESOLVED_BY_AGE is excluded (auto-resolve cron, no acting user, so no signal).
# SET_RESOLVED_IN_PULL_REQUEST is excluded (it will trigger ASSIGNED in practice, which we already capture).
# Other ground-truth activities include ASSIGNED and SEER_*_STARTED,
# configured in workflow_activity_handlers.py
RESOLUTION_ACTIVITIES = frozenset(
    {
        ActivityType.SET_RESOLVED,
        ActivityType.SET_RESOLVED_IN_RELEASE,
        ActivityType.SET_RESOLVED_IN_COMMIT,
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


class SmartAssignmentPayload(BaseModel):
    group_id: int
    project_slug: str | None = None


class RankedCandidate(BaseModel):
    identifier: str
    identifier_kind: Literal["email", "username"]
    reason: str = ""
    signals: list[str] = Field(default_factory=list)
    confidence: str = ""


class AssigneeVerdict(BaseModel):
    """The artifact Seer delivers: ranked best-first, empty == no confident pick."""

    candidates: list[RankedCandidate] = Field(default_factory=list)
