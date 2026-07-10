"""Gating, dispatch, and ground-truth capture for the smart assignment feature.

`maybe_trigger_smart_assignment` is the single gated entrypoint: it checks the
feature flag, dedups to one prediction per issue, and dispatches the Seer
`smart_assignment` feature run, creating the `SeerSmartAssignmentResult` row
atomically with the run. `record_ground_truth` annotates an existing row with who
actually got assigned / resolved the issue.
"""

from __future__ import annotations

import logging

from django.db import IntegrityError
from django.utils import timezone

from sentry import features
from sentry.models.group import Group
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

FEATURE_FLAG = "organizations:seer-smart-assignment"
FEATURE_ID = "smart_assignment"


def _skip(reason: str, group: Group) -> None:
    metrics.incr("smart_assignment.trigger.skipped", tags={"reason": reason})
    logger.info(
        "smart_assignment.trigger.skipped",
        extra={"reason": reason, "group_id": group.id, "organization_id": group.organization.id},
    )


def maybe_trigger_smart_assignment(group: Group, trigger: SmartAssignmentTrigger) -> None:
    """Gate and dispatch a smart-assignment prediction for `group`.

    No-op unless the org is flagged and no prediction row already exists for the
    group. Safe to call from any event hook (e.g. an activity handler now, or
    post_process later).
    """
    organization = group.organization

    if not features.has(FEATURE_FLAG, organization):
        _skip("flag_disabled", group)
        return

    if SeerSmartAssignmentResult.objects.filter(group_id=group.id).exists():
        _skip("already_predicted", group)
        return

    try:
        client = SeerAgentClient(
            organization,
            project=group.project,
            group=group,
            category_key=FEATURE_ID,
            category_value=str(group.id),
        )
    except SeerPermissionError:
        _skip("no_seer_access", group)
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
        _skip("already_predicted_race", group)
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
    *,
    assignee_user_id: int | None = None,
    resolver_user_id: int | None = None,
) -> None:
    """Annotate an existing prediction row with observed ground truth.

    No-op if no prediction was made for the group. Only fields with a provided,
    non-null id are written.
    """
    row = SeerSmartAssignmentResult.objects.filter(group_id=group.id).first()
    if row is None:
        return

    updates: dict[str, object] = {}
    now = timezone.now()
    if assignee_user_id is not None:
        updates["actual_assignee_user_id"] = assignee_user_id
        updates["assigned_at"] = now
    if resolver_user_id is not None:
        updates["actual_resolver_user_id"] = resolver_user_id
        updates["resolved_at"] = now
    if not updates:
        return

    row.update(**updates)
    metrics.incr("smart_assignment.ground_truth.recorded")
