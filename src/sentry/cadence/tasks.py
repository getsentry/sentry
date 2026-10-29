from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from django.db import router, transaction
from django.utils import timezone

from sentry import options
from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import TriggerContext, trigger_action_registry
from sentry.cadence.schedule import advance
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

TICK_BATCH_SIZE = 500
TICK_MAX_BATCHES = 20


@instrumented_task(
    name="sentry.cadence.tasks.cadence_tick",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def cadence_tick() -> None:
    """
    Claim every trigger that is due and dispatch its run, in batches. Each batch is
    claimed and committed before its actions are called, and each trigger type's action
    is called once with all of that type's runs in the batch.

    Delivery is best-effort, not guaranteed: claimed runs are lost if their action fails,
    and a run may occasionally be dispatched twice. Runs missed while the tick is behind
    or disabled are skipped, not caught up.
    """
    if not options.get("cadence.tick.enabled"):
        return
    now = timezone.now()
    claimed_count = 0
    try:
        for _ in range(TICK_MAX_BATCHES):
            claimed, selected = _claim_batch(now)
            claimed_count += len(claimed)
            _dispatch(claimed)
            if selected < TICK_BATCH_SIZE:
                return
        logger.warning("cadence.tick.batch_limit_reached", extra={"max_batches": TICK_MAX_BATCHES})
    finally:
        metrics.distribution("cadence.tick.claimed", claimed_count)


def _claim_batch(now: datetime) -> tuple[dict[ScheduledTriggerType, list[TriggerContext]], int]:
    """
    Advance the next run of up to TICK_BATCH_SIZE due triggers, returning the claimed runs
    grouped by trigger type, and how many triggers were selected. Rows locked by a
    concurrent tick are skipped, so overlapping ticks split the work.
    """
    claimed: dict[ScheduledTriggerType, list[TriggerContext]] = defaultdict(list)
    with transaction.atomic(using=router.db_for_write(ScheduledTrigger)):
        due = list(
            ScheduledTrigger.objects.select_for_update(skip_locked=True)
            .filter(next_run_at__lte=now)
            .order_by("next_run_at")[:TICK_BATCH_SIZE]
        )
        for trigger in due:
            scheduled_for = trigger.next_run_at
            assert scheduled_for is not None
            # A bad row must not fail the batch: it would stay due and block every tick.
            try:
                trigger.next_run_at = advance(trigger, scheduled_for, now)
                trigger_type = ScheduledTriggerType(trigger.trigger_type)
            except Exception:
                logger.exception(
                    "cadence.trigger.unschedulable",
                    extra={"trigger_id": trigger.id, "trigger_type": trigger.trigger_type},
                )
                trigger.next_run_at = None
                continue
            claimed[trigger_type].append(
                TriggerContext(
                    organization_id=trigger.organization_id,
                    trigger_type=trigger_type,
                    target_id=trigger.target_id,
                    scheduled_for=scheduled_for,
                )
            )
        ScheduledTrigger.objects.bulk_update(due, ["next_run_at"])
    return claimed, len(due)


def _dispatch(claimed: dict[ScheduledTriggerType, list[TriggerContext]]) -> None:
    """Call each trigger type's action with its runs. One type's failure doesn't affect others."""
    dispatched_at = timezone.now()
    for trigger_type, contexts in claimed.items():
        tags = {"trigger_type": trigger_type.value}
        for ctx in contexts:
            metrics.distribution(
                "cadence.trigger.dispatch_lag",
                (dispatched_at - ctx.scheduled_for).total_seconds(),
                tags=tags,
                unit="second",
            )
        _dispatch_type(trigger_type, contexts, tags)


def _dispatch_type(
    trigger_type: ScheduledTriggerType, contexts: Sequence[TriggerContext], tags: dict[str, str]
) -> None:
    try:
        with metrics.timer("cadence.trigger.dispatch_duration", tags=tags):
            trigger_action_registry.get(trigger_type)(contexts)
    except Exception:
        metrics.incr("cadence.trigger.dispatch_failed", amount=len(contexts), tags=tags)
        logger.exception(
            "cadence.trigger.dispatch_failed",
            extra={"trigger_type": trigger_type.value, "run_count": len(contexts)},
        )
