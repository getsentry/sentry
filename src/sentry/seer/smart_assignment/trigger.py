"""Gating, dispatch, and ground-truth capture for the smart assignment feature.

`maybe_trigger_smart_assignment` is the single gated entrypoint: it checks the
feature flag, dedups to one prediction per issue (so a run is only dispatched the
first time), enforces per-org and global daily dispatch caps, and records the
observed ground truth whether or not a new run was dispatched. It takes a
`SmartAssignmentTrigger` (not an `ActivityType`) so callers that aren't driven by
an activity can trigger too.
"""

from __future__ import annotations

import logging

from django.db import IntegrityError
from django.utils import timezone

from sentry import features, options
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.ratelimits import backend as ratelimiter
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.models.run import SeerRun
from sentry.seer.models.smart_assignment import (
    SeerSmartAssignmentResult,
    SmartAssignmentStatus,
    SmartAssignmentTrigger,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:seer-smart-assignment-run"
FEATURE_ID = "smart_assignment"

# Marker the acting code stamps into the ASSIGNED activity's data (via the assign()
# `extra` dict) when it auto-assigns based on a prediction. Lets ground-truth
# capture skip our own assignment -- recording it would just score us against
# ourselves.
AUTO_ASSIGN_SOURCE = "seer_smart_assignment"

# Rolling window (seconds) for the per-org and global dispatch caps below.
_RATE_LIMIT_WINDOW = 86400


def maybe_trigger_smart_assignment(
    group: Group,
    trigger: SmartAssignmentTrigger,
    activity: Activity | None = None,
) -> None:
    """Gate + dispatch a prediction for `group`, and record ground truth.

    Dispatches a Seer run the first time (deduped to one row per group, and subject
    to per-org / global daily caps); records the observed ground truth for
    `ASSIGNMENT` / `RESOLUTION` triggers either way. Note the caps only gate new
    dispatches -- ground truth is still recorded for already-predicted issues.
    `activity` is only needed to capture the resolving user for a `RESOLUTION`.
    No-op unless the org is flagged. Automatic resolutions (no acting user, e.g.
    resolved by age) are skipped entirely -- we only treat a resolution as signal
    when a human resolved the issue, since then they probably should have been the
    assignee.
    """
    organization = group.organization

    if not features.has(FEATURE_FLAG, organization):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "flag_disabled"})
        return

    if trigger == SmartAssignmentTrigger.RESOLUTION and (
        activity is None or activity.user_id is None
    ):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "automatic_resolution"})
        return

    if not SeerSmartAssignmentResult.objects.filter(group_id=group.id).exists():
        if not _dispatch_rate_limited(organization):
            _dispatch(group, trigger)

    record_ground_truth(group, trigger, activity)


def _dispatch_rate_limited(organization: Organization) -> bool:
    """True if we've hit the per-org or global daily dispatch cap.

    A safety ceiling on Seer spend, layered on top of the flag and per-issue
    dedup. Both caps are rolling 24h windows backed by the Redis ratelimiter. We
    check the per-org bucket first so a single noisy org rejects without eating
    into the global budget.
    """
    if ratelimiter.is_limited(
        f"smart_assignment:dispatch:org:{organization.id}",
        limit=options.get("seer.smart_assignment.max_dispatches_per_org_per_day"),
        window=_RATE_LIMIT_WINDOW,
    ):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "org_rate_limited"})
        return True

    if ratelimiter.is_limited(
        "smart_assignment:dispatch:global",
        limit=options.get("seer.smart_assignment.max_dispatches_per_day"),
        window=_RATE_LIMIT_WINDOW,
    ):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "global_rate_limited"})
        return True

    return False


def _dispatch(group: Group, trigger: SmartAssignmentTrigger) -> None:
    """Dispatch a Seer smart-assignment run and create the pending result row."""
    organization = group.organization

    try:
        client = SeerAgentClient(
            organization,
            project=group.project,
            group=group,
            category_key=FEATURE_ID,
            category_value=str(group.id),
        )
    except SeerPermissionError:
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "no_seer_access"})
        return

    def _create_row(run: SeerRun) -> None:
        SeerSmartAssignmentResult.objects.create(
            organization_id=organization.id,
            group_id=group.id,
            result_seer_run=run,
            trigger=trigger,
            status=SmartAssignmentStatus.PENDING,
        )

    title = f"Smart assignment for {group.qualified_short_id or group.id}"
    try:
        client.start_feature_run(
            feature_id=FEATURE_ID,
            payload={"group_id": group.id, "project_slug": group.project.slug},
            title=title,
            flush=False,
            on_run_created=_create_row,
        )
    except IntegrityError:
        # A concurrent trigger already created the row (unique on group); the run
        # dispatch is rolled back with it. Treat as a dedup no-op.
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "already_predicted_race"})
        return
    except SeerApiError:
        logger.exception("smart_assignment.trigger.dispatch_failed", extra={"group_id": group.id})
        return

    metrics.incr("smart_assignment.trigger.dispatched", tags={"trigger": trigger})
    logger.info(
        "smart_assignment.trigger.dispatched",
        extra={"group_id": group.id, "organization_id": organization.id, "trigger": trigger},
    )


def record_ground_truth(
    group: Group,
    trigger: SmartAssignmentTrigger,
    activity: Activity | None = None,
) -> None:
    """Annotate an existing prediction row with ground truth for the given outcome.

    No-op if no prediction was made for the group, or the outcome carries no useful
    signal: `PR_CREATED`, an automatic resolution with no acting user, or our own
    auto-assignment (tagged with `AUTO_ASSIGN_SOURCE`, which would just score us
    against ourselves). For an assignment we mirror the current assignee (user
    and/or team). For a user-driven resolution we record the resolver as the assumed
    assignee only when no explicit assignee is set -- an assignment is better ground
    truth than the resolver.
    """
    row = SeerSmartAssignmentResult.objects.filter(group_id=group.id).first()
    if row is None:
        return

    updates: dict[str, object] = {}
    if trigger == SmartAssignmentTrigger.ASSIGNMENT:
        if activity is not None and (activity.data or {}).get("source") == AUTO_ASSIGN_SOURCE:
            # Our own auto-assignment from a prediction isn't independent ground
            # truth -- recording it would just score us against ourselves.
            return
        assignee = GroupAssignee.objects.filter(group=group).first()
        if assignee is None:
            return
        # Current assignment is authoritative: set whichever of user/team it is and
        # clear the other so the row reflects the latest assignee.
        updates["actual_assignee_user_id"] = assignee.user_id
        updates["actual_assignee_team_id"] = assignee.team_id
    elif trigger == SmartAssignmentTrigger.RESOLUTION:
        if activity is None or activity.user_id is None:
            return
        if row.actual_assignee_user_id is not None:
            # An explicit assignee is better ground truth than the resolver; don't
            # overwrite it with whoever happened to resolve the issue.
            return
        # No assignee yet: treat the resolving user as the assumed assignee. Keep any
        # existing team assignee (a user resolving a team-assigned issue is extra
        # signal that they're on that team, not a correction).
        updates["actual_assignee_user_id"] = activity.user_id
    else:
        return

    updates["ground_truth_source"] = trigger
    updates["ground_truth_at"] = timezone.now()
    row.update(**updates)
    metrics.incr("smart_assignment.ground_truth.recorded", tags={"trigger": trigger})
