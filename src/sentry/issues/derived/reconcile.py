from __future__ import annotations

import logging

from sentry import features, options
from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.issues.action_log import SYSTEM_ACTOR, ActionSource, publish_action
from sentry.issues.action_log.types import ReconcileStatusAction
from sentry.issues.derived.check import StatusInconsistency, check_status_consistency
from sentry.issues.derived.gate import derived_should_be_correct
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.locks import locks
from sentry.models.group import Group
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

_RECONCILE_STATUS_LOCK_DURATION = 30


def _has_pending_group_action_log_outbox(group_id: int) -> bool:
    """Return whether any action-log outbox rows are pending for *group_id*."""
    filter_kwargs = dict(
        shard_scope=OutboxScope.GROUP_SCOPE,
        shard_identifier=group_id,
        category=OutboxCategory.GROUP_ACTION_LOG_EVENT,
    )
    return (
        CellOutbox.objects.filter(**filter_kwargs).exists()
        or GroupActionLogOutbox.objects.filter(**filter_kwargs).exists()
    )


def _record_result(result: str, **extra_tags: str) -> None:
    tags = {"result": result, **extra_tags}
    metrics.incr(
        "issues.derived.reconcile_group_status.result",
        sample_rate=1.0,
        tags=tags,
    )


def reconcile_group_status(group_id: int) -> None:
    """Publish a ReconcileStatusAction when Group status and GDD disagree.

    Runs under a group-scoped Redis lock. Bails unless derived data is on the
    current pipeline hash, there are no pending action-log outbox rows, and the
    observed inconsistency is stable across a re-read.
    """
    logger.info("reconcile_group_status.started", extra={"group_id": group_id})

    if options.get("issues.derived_data.read_path_checks.killswitch"):
        _record_result("killswitched")
        return

    lock = locks.get(
        f"reconcile_group_status:{group_id}",
        duration=_RECONCILE_STATUS_LOCK_DURATION,
        name="reconcile_group_status",
    )
    try:
        with lock.acquire():
            group = Group.objects.filter(id=group_id).select_related("project").first()
            if group is None:
                _record_result("group_not_found")
                return

            if not (
                features.has("projects:issue-status-reconciliation", group.project)
                or derived_should_be_correct(group.project)
            ):
                _record_result("not_gated")
                return

            derived = GroupDerivedData.objects.filter(group_id=group_id).first()
            if derived is None:
                _record_result("no_derived_data")
                return

            if derived.pipeline_hash != PIPELINE.pipeline_hash:
                _record_result("stale_hash")
                return

            inconsistency = check_status_consistency(group, derived)
            if inconsistency is None:
                _record_result("aligned")
                return

            observed_group_status = group.status
            observed_generated_at = derived.generated_at
            observed_inconsistency: StatusInconsistency = inconsistency

            if _has_pending_group_action_log_outbox(group_id):
                _record_result("pending_outbox")
                return

            group = Group.objects.filter(id=group_id).select_related("project").first()
            derived = GroupDerivedData.objects.filter(group_id=group_id).first()
            if (
                group is None
                or derived is None
                or group.status != observed_group_status
                or derived.generated_at != observed_generated_at
                or derived.pipeline_hash != PIPELINE.pipeline_hash
            ):
                _record_result("changed_during_check")
                return

            recheck = check_status_consistency(group, derived)
            if recheck != observed_inconsistency:
                _record_result("changed_during_check")
                return

            if _has_pending_group_action_log_outbox(group_id):
                _record_result("pending_outbox")
                return

            target_status = observed_inconsistency.actual.value
            publish_action(
                ReconcileStatusAction(
                    status=target_status,
                    reason=f"group_status:{group.get_status_display()}",
                ),
                source=ActionSource.SYSTEM,
                group_id=group.id,
                project=group.project,
                actor=SYSTEM_ACTOR,
            )
            logger.info(
                "reconcile_group_status.published",
                extra={
                    "group_id": group.id,
                    "target_status": target_status,
                    "observed_derived_status": observed_inconsistency.derived.value,
                    "derived_generated_at": observed_generated_at.isoformat(),
                },
            )
            _record_result("published", target_status=target_status)
    except UnableToAcquireLock:
        _record_result("locked_out")
