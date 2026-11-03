from __future__ import annotations

import logging
import time
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db import router, transaction
from django.utils import timezone

from sentry import options
from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import TriggerContext, trigger_type_registry
from sentry.cadence.schedule import advance
from sentry.cadence.spread import offset_of
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.registry import NoRegistrationExistsError

logger = logging.getLogger(__name__)

TICK_BATCH_SIZE = 500
# A tick stops claiming after this, well short of its 60s processing deadline, and leaves
# the rest to later ticks.
TICK_CLAIM_SECONDS = 40


@dataclass(frozen=True)
class _ClaimedRun:
    context: TriggerContext
    # When the run was due to be handed off: its scheduled_for plus its offset.
    run_at: datetime


# TODO: Pick a more appropriate namespace. A backlog of unrelated issues tasks delays the
# tick, and with it every schedule.
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
    start = time.monotonic()
    claimed_count = 0
    try:
        while True:
            claimed, selected = _claim_batch(now)
            claimed_count += sum(len(contexts) for contexts in claimed.values())
            _dispatch(claimed)
            if selected < TICK_BATCH_SIZE:
                return
            if time.monotonic() - start >= TICK_CLAIM_SECONDS:
                logger.warning("cadence.tick.time_limit_reached", extra={"claimed": claimed_count})
                return
    finally:
        metrics.distribution("cadence.tick.claimed", claimed_count)


def _claim_batch(now: datetime) -> tuple[dict[ScheduledTriggerType, list[_ClaimedRun]], int]:
    """
    Advance the next run of up to TICK_BATCH_SIZE due triggers, returning the claimed runs
    grouped by trigger type, and how many triggers were selected. Rows locked by a
    concurrent tick are skipped, so overlapping ticks split the work.
    """
    claimed: dict[ScheduledTriggerType, list[_ClaimedRun]] = defaultdict(list)
    with transaction.atomic(using=router.db_for_write(ScheduledTrigger)):
        due = list(
            ScheduledTrigger.objects.select_for_update(skip_locked=True)
            .filter(next_run_at__lte=now)
            .order_by("next_run_at")[:TICK_BATCH_SIZE]
        )
        for trigger in due:
            scheduled_for = trigger.next_scheduled_for
            run_at = trigger.next_run_at
            assert scheduled_for is not None and run_at is not None
            # A bad row must not fail the batch: it would stay due and block every tick.
            try:
                trigger_type = ScheduledTriggerType(trigger.trigger_type)
                # Uses the trigger type's current spread window, so a changed window takes
                # effect from each trigger's next run.
                try:
                    offset = offset_of(trigger)
                except NoRegistrationExistsError:
                    # Without a registered action this run is lost when dispatched, but the
                    # schedule is kept so it runs once the action is deployed.
                    offset = timedelta(0)
                # A scheduled time that has passed is still next if its offset run hasn't.
                trigger.next_scheduled_for = advance(trigger, scheduled_for, now - offset)
                trigger.next_run_at = trigger.next_scheduled_for + offset
            except Exception:
                logger.exception(
                    "cadence.trigger.unschedulable",
                    extra={"trigger_id": trigger.id, "trigger_type": trigger.trigger_type},
                )
                trigger.next_scheduled_for = None
                trigger.next_run_at = None
                continue
            claimed[trigger_type].append(
                _ClaimedRun(
                    context=TriggerContext(
                        organization_id=trigger.organization_id,
                        trigger_type=trigger_type,
                        target_id=trigger.target_id,
                        scheduled_for=scheduled_for,
                    ),
                    run_at=run_at,
                )
            )
        ScheduledTrigger.objects.bulk_update(due, ["next_scheduled_for", "next_run_at"])
    return claimed, len(due)


def _dispatch(claimed: dict[ScheduledTriggerType, list[_ClaimedRun]]) -> None:
    """Call each trigger type's action with its runs. One type's failure doesn't affect others."""
    dispatched_at = timezone.now()
    for trigger_type, runs in claimed.items():
        tags = {"trigger_type": trigger_type.value}
        for run in runs:
            # Measured from when the run was due, so a trigger's offset isn't counted as lag.
            metrics.distribution(
                "cadence.trigger.dispatch_lag",
                (dispatched_at - run.run_at).total_seconds(),
                tags=tags,
                unit="second",
            )
        _dispatch_type(trigger_type, [run.context for run in runs], tags)


def _dispatch_type(
    trigger_type: ScheduledTriggerType, contexts: Sequence[TriggerContext], tags: dict[str, str]
) -> None:
    try:
        with metrics.timer("cadence.trigger.dispatch_duration", tags=tags):
            trigger_type_registry.get(trigger_type).action(contexts)
    except Exception:
        metrics.incr("cadence.trigger.dispatch_failed", amount=len(contexts), tags=tags)
        logger.exception(
            "cadence.trigger.dispatch_failed",
            extra={"trigger_type": trigger_type.value, "run_count": len(contexts)},
        )
