"""Wire types for the smart_assignment feature, in sync with Seer's
seer.automation.features.smart_assignment.models. Covers both the request payload
(Sentry -> Seer) and the result artifact (Seer -> Sentry).

Fields Sentry doesn't switch on (`signals`, `confidence`) are typed as plain
strings rather than mirroring Seer's Literals on purpose: this is a cross-service
contract, and loosening them here means Seer adding a new signal source or
confidence level can't make an otherwise-valid artifact fail to parse. `reason`
and `confidence` are defaulted so a minimal-but-valid candidate (one that at least
names someone) still round-trips.

Also includes some utility functions for validating assignments.
"""

from __future__ import annotations

from typing import Literal

from django.db import models
from pydantic import BaseModel, Field

from sentry.models.activity import Activity, ActivityIntegration
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

# We invalidate scoring against "ground truth" assignments from these sources, because they're
# basically non-human actions: our own auto-assignment, project ownership, CODEOWNERS,
# and the suspect commit feature. The agent is likely to make similar choices, so scoring
# against these would inflate our success rate.
UNSCORABLE_ASSIGNMENT_ORIGINS = frozenset(
    {
        ActivityIntegration.SEER_SUGGESTED.value,
        ActivityIntegration.PROJECT_OWNERSHIP.value,
        ActivityIntegration.CODEOWNERS.value,
        ActivityIntegration.SUSPECT_COMMITTER.value,
    }
)


def is_unscorable_assignment(activity: Activity | None) -> bool:
    if activity is None or activity.type != ActivityType.ASSIGNED.value:
        return False
    return (activity.data or {}).get("integration") in UNSCORABLE_ASSIGNMENT_ORIGINS


class SmartAssignmentScore(models.TextChoices):
    """How a delivered prediction scored against the observed ground truth.

    Coarse live signal (emitted as the `smart_assignment.scored` metric) with
    partial credit for landing on the right team; the authoritative verdict/run
    content lives in Seer.
    """

    EXACT = "exact"  # predicted user is the actual assignee
    TEAM = "team"  # the issue went to a team, and the predicted user is on it
    SHARED_TEAM = "shared-team"  # predicted user shares a team with the actual assignee
    MISS = "miss"  # none of the above


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
