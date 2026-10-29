from __future__ import annotations

import logging
from datetime import datetime

from django.utils import timezone

from sentry import options
from sentry.cadence.models import ScheduledTrigger
from sentry.cadence.registry import trigger_action_registry
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
    Claim every trigger that is due and dispatch a run for each.

    Delivery is best-effort, not guaranteed: a claimed run is lost if dispatching it
    fails, and taskbroker may occasionally deliver a run twice. Runs missed while the
    tick is behind or disabled are skipped, not caught up.
    """
    if not options.get("cadence.tick.enabled"):
        return
    now = timezone.now()
    claimed_count = 0
    try:
        for _ in range(TICK_MAX_BATCHES):
            due = list(
                ScheduledTrigger.objects.filter(next_run_at__lte=now).order_by("next_run_at")[
                    :TICK_BATCH_SIZE
                ]
            )
            claimed_at = timezone.now()
            for trigger in due:
                scheduled_for = trigger.next_run_at
                assert scheduled_for is not None
                # Only the process that moves next_run_at forward gets to dispatch the run.
                claimed = ScheduledTrigger.objects.filter(
                    id=trigger.id, next_run_at=scheduled_for
                ).update(next_run_at=advance(trigger, scheduled_for, now), last_run_at=now)
                if not claimed:
                    continue
                claimed_count += 1
                metrics.distribution(
                    "cadence.trigger.claim_lag",
                    (claimed_at - scheduled_for).total_seconds(),
                    tags={"trigger_type": trigger.trigger_type},
                    unit="second",
                )
                execute_scheduled_trigger.delay(trigger.id, scheduled_for.isoformat())
            if len(due) < TICK_BATCH_SIZE:
                return
        logger.warning("cadence.tick.batch_limit_reached", extra={"max_batches": TICK_MAX_BATCHES})
    finally:
        metrics.distribution("cadence.tick.claimed", claimed_count)


@instrumented_task(
    name="sentry.cadence.tasks.execute_scheduled_trigger",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def execute_scheduled_trigger(trigger_id: int, scheduled_for: str) -> None:
    """
    Run the registered action for a trigger. A run is usually executed exactly once,
    but may occasionally be lost or executed twice (see cadence_tick).

    Action failures are logged and recorded, not raised or retried: the next run is
    already scheduled, and a failing action must not affect the task or other triggers.
    """
    if not options.get("cadence.tick.enabled"):
        return
    scheduled_for_dt = datetime.fromisoformat(scheduled_for)
    trigger = ScheduledTrigger.objects.get_or_none(id=trigger_id)
    if trigger is None:
        return

    tags = {"trigger_type": trigger.trigger_type}
    metrics.distribution(
        "cadence.trigger.execute_lag",
        (timezone.now() - scheduled_for_dt).total_seconds(),
        tags=tags,
        unit="second",
    )
    try:
        with metrics.timer("cadence.trigger.execute_duration", tags=tags):
            action = trigger_action_registry.get(trigger.trigger_type)
            action(trigger.id, scheduled_for_dt)
    except Exception:
        logger.exception(
            "cadence.trigger.execute_failed",
            extra={
                "trigger_id": trigger.id,
                "trigger_type": trigger.trigger_type,
                "scheduled_for": scheduled_for,
            },
        )
