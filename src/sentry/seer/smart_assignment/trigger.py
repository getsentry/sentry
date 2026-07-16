from __future__ import annotations

import logging

from sentry import features, options
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits import backend as ratelimiter
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.smart_assignment.models import (
    RESOLUTION_ACTIVITIES,
    SEER_FEATURE_ID,
    SmartAssignmentPayload,
)
from sentry.types.activity import ActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:seer-smart-assignment-run"

# Rolling window (seconds) for the per-org and global dispatch caps below.
_RATE_LIMIT_WINDOW = 86400


def trigger_smart_assignment(
    group: Group,
    activity_type: ActivityType,
    activity: Activity | None = None,
) -> None:
    """Gate + dispatch a prediction for `group`.

    Dispatches a Seer run the first time (deduped to one run per group, and subject
    to per-org / global daily caps). `activity_type` is what triggered us (a Seer AI
    step starting, an assignment, or a resolution); `activity` is the triggering
    activity, stamped with a pointer to the run it kicked off. No-op unless the org
    is flagged. Automatic resolutions (no acting user, e.g. resolved by age) are
    skipped entirely -- we only treat a resolution as signal when a human resolved
    the issue, since then they probably should have been the assignee.
    """
    organization = group.organization

    if not features.has(FEATURE_FLAG, organization):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "flag_disabled"})
        return

    if activity_type in RESOLUTION_ACTIVITIES and (activity is None or activity.user_id is None):
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "automatic_resolution"})
        return

    # Policy gate: today we predict at most once per issue, ever. This lives in app
    # code (not a DB constraint) so re-runs are cheap to enable later -- e.g. gate on
    # a cooldown or a new-signal check against the latest run instead. The run mirror
    # is our durable record that a run was dispatched.
    if not _already_predicted(group) and not _dispatch_rate_limited(organization):
        _dispatch(group, activity_type, activity)


def _already_predicted(group: Group) -> bool:
    """Whether a smart-assignment run has ever been dispatched for this group.

    Keyed off the Seer run mirror (source="smart_assignment"), a local query -- no
    cross-service call. Best-effort: a rare concurrent trigger could slip a second
    run past this before the first mirror commits, which the daily caps still bound.
    """
    return SeerAgentRun.objects.filter(group_id=group.id, source=SEER_FEATURE_ID).exists()


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


def _dispatch(group: Group, activity_type: ActivityType, activity: Activity | None) -> None:
    """Dispatch a Seer smart-assignment run and stamp the triggering activity.

    The run's Sentry-side mirror (`SeerAgentRun`) is created inside `start_feature_run`
    with `source=SEER_FEATURE_ID`, `group`, and the `extras` we seed here -- that's the
    dedup key and the scoring bookkeeping row. The triggering activity is stamped with
    a pointer to the run so an action can be traced to the run it kicked off.
    """
    organization = group.organization

    try:
        client = SeerAgentClient(organization, project=group.project, group=group)
    except SeerPermissionError:
        metrics.incr("smart_assignment.trigger.skipped", tags={"reason": "no_seer_access"})
        return

    extras: dict[str, object] = {"trigger": activity_type.name}
    if activity is not None:
        extras["triggering_activity_id"] = activity.id

    payload = SmartAssignmentPayload(group_id=group.id, project_slug=group.project.slug)
    title = f"Smart assignment for {group.qualified_short_id or group.id}"
    try:
        run = client.start_feature_run(
            feature_id=SEER_FEATURE_ID,
            payload=payload.dict(),
            title=title,
            flush=False,
            extras=extras,
        )
    except SeerApiError:
        logger.exception("smart_assignment.trigger.dispatch_failed", extra={"group_id": group.id})
        return

    if activity is not None:
        _stamp_activity(activity, run, activity_type)

    metrics.incr("smart_assignment.trigger.dispatched", tags={"trigger": activity_type.name})
    logger.info(
        "smart_assignment.trigger.dispatched",
        extra={
            "group_id": group.id,
            "organization_id": organization.id,
            "trigger": activity_type.name,
        },
    )


def _stamp_activity(activity: Activity, run: SeerRun, activity_type: ActivityType) -> None:
    """Record a pointer to the dispatched run on the activity that triggered it.

    Written under the `seer_smart_assignment` key so an action (assignment, PR,
    resolution) can be traced to the run it kicked off. `data` is unindexed text JSON,
    so this is for display/traceability, not querying -- to list runs (and their
    triggering activity ids) use the `SeerAgentRun` mirror.
    """
    data = dict(activity.data or {})
    data["seer_smart_assignment"] = {
        "run_id": run.id,
        "run_uuid": str(run.uuid),
        "trigger": activity_type.name,
    }
    activity.data = data
    activity.save()
