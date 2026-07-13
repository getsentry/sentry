"""Gating and dispatch for the smart assignment feature.

`maybe_trigger_smart_assignment` is the single gated entrypoint: it checks the
feature flag, dedups to one prediction per issue (so a run is only dispatched the
first time), enforces per-org and global daily dispatch caps, and records the
observed ground truth (via `scoring.record_ground_truth`) whether or not a new run
was dispatched. It takes a `SmartAssignmentTrigger` (not an `ActivityType`) so
callers that aren't driven by an activity can trigger too.
"""

from __future__ import annotations

import logging

from django.db import IntegrityError

from sentry import features, options
from sentry.models.activity import Activity
from sentry.models.group import Group
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
from sentry.seer.smart_assignment.scoring import record_ground_truth
from sentry.utils import metrics

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:seer-smart-assignment-run"
FEATURE_ID = "smart_assignment"

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

    # Policy gate: today we predict at most once per issue, ever. This lives in app
    # code (not the DB constraint, which only prevents concurrent in-flight runs) so
    # re-runs are cheap to enable later -- e.g. swap this for a `status=PENDING`
    # check to allow a fresh run once the previous one finished, or gate on a
    # cooldown/new-signal check against the latest row. No migration required.
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
        # A concurrent trigger already created an in-flight row for this group (the
        # partial unique index allows only one PENDING row per group); its run
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
