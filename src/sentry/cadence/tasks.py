from __future__ import annotations

import logging
import operator
import time
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import reduce

from django.db import connections, router, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from sentry import options
from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import TriggerFiring, TriggerTarget, trigger_type_registry
from sentry.cadence.schedule import MAX_MISSED_CRON_FIRINGS, advance, missed_between
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
# The tick only claims triggers due within this long before now; the sweep claims the rest.
# Bounding the tick's scan keeps it clear of the stale index entries left by older claims.
TICK_WINDOW = timedelta(minutes=10)
# Triggers whose schedule was set more recently than this aren't checked for missing targets,
# so a trigger set alongside its target isn't deleted before the target is visible.
MISSING_TARGET_CHECK_SETTLE_WINDOW = timedelta(hours=1)


@dataclass(frozen=True)
class _ClaimedFiring:
    firing: TriggerFiring
    # When the firing was due to be dispatched: its scheduled_for plus its offset.
    fire_at: datetime
    # When the trigger's schedule was last changed. The tick's own updates don't change it.
    date_updated: datetime
    missed: int
    missed_count_capped: bool


@dataclass(frozen=True)
class _Cursor:
    """The (next_fire_at, id) of the last trigger a tick selected, before it was advanced."""

    fire_at: datetime
    id: int


# TODO: Pick a more appropriate namespace. A backlog of unrelated issues tasks delays the
# tick, and with it every trigger.
@instrumented_task(
    name="sentry.cadence.tasks.cadence_tick",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def cadence_tick() -> None:
    """
    Claim every trigger that came due within TICK_WINDOW and dispatch its firing, in batches.
    Each batch is claimed and committed before its firings are dispatched. Each trigger type's
    firings in the batch may be checked for missing targets, opportunistically, and those found
    are dropped and their triggers deleted. The rest are dispatched in one call. Triggers due
    before the window are left to the sweep.

    Delivery is best-effort, not guaranteed: claimed firings are lost if their dispatch fails,
    and a firing may occasionally be dispatched twice. Firings missed while the tick is
    behind or disabled are skipped, not caught up.
    """
    now = timezone.now()
    # Includes triggers due exactly at the window's start: every id is above 0.
    _claim_and_dispatch(now, _Cursor(fire_at=now - TICK_WINDOW, id=0), now, "tick")


@instrumented_task(
    name="sentry.cadence.tasks.cadence_sweep",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def cadence_sweep() -> None:
    """
    A lower-frequency check for triggers that were missed and are outside the tick's window.
    """
    if not options.get("cadence.tick.enabled"):
        return
    # Fewer than one would silently stop the sweep, and triggers before the tick's window
    # would never fire.
    workers = max(1, options.get("cadence.sweep.workers"))
    if workers == 1:
        cadence_sweep_worker()
        return
    for _ in range(workers):
        cadence_sweep_worker.delay()


@instrumented_task(
    name="sentry.cadence.tasks.cadence_sweep_worker",
    namespace=issues_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def cadence_sweep_worker() -> None:
    """
    Claim and dispatch triggers that came due before the tick's window, like the tick does.
    These are rare stragglers normally, and a backlog after Cadence has been behind or
    disabled. Like the tick's, their firings are dispatched once, late, and missed ones skipped.
    """
    now = timezone.now()
    # Timestamps have microsecond resolution, so this is the latest time before the tick's
    # window: together they cover every due trigger, once.
    # TODO: If the full scan is slow, cache a lower bound to start from (e.g. the oldest
    # next_fire_at the last sweep left unclaimed). Rows can be written below such a bound
    # (schedules set in the past, rows skipped while locked), so it needs a rare unbounded
    # sweep or a reset on schedule writes.
    _claim_and_dispatch(now, None, now - TICK_WINDOW - timedelta(microseconds=1), "sweep")


def _claim_and_dispatch(
    now: datetime, after: _Cursor | None, due_by: datetime, source: str
) -> None:
    """
    Claim and dispatch triggers due by `due_by` after `after`, in batches, until none are left
    or TICK_CLAIM_SECONDS have passed. `source` tags metrics with the task claiming.
    """
    if not options.get("cadence.tick.enabled"):
        return
    tags = {"source": source}
    start = time.monotonic()
    claimed_count = 0
    try:
        while True:
            with metrics.timer("cadence.tick.claim_batch_duration", tags=tags, sample_rate=1.0):
                claimed, selected, after = _claim_batch(now, after, due_by)
            claimed_count += sum(len(firings) for firings in claimed.values())
            _dispatch(claimed, source)
            if selected < TICK_BATCH_SIZE:
                return
            if time.monotonic() - start >= TICK_CLAIM_SECONDS:
                metrics.incr("cadence.tick.time_limit_reached", tags=tags, sample_rate=1.0)
                logger.warning(
                    "cadence.tick.time_limit_reached",
                    extra={"claimed": claimed_count, "source": source},
                )
                return
    finally:
        metrics.distribution("cadence.tick.claimed", claimed_count, tags=tags, sample_rate=1.0)


def _claim_batch(
    now: datetime, after: _Cursor | None, due_by: datetime
) -> tuple[dict[ScheduledTriggerType, list[_ClaimedFiring]], int, _Cursor | None]:
    """
    Claim up to TICK_BATCH_SIZE triggers that are due by `due_by` and come after the `after`
    cursor, and move each to its next firing after `now`.

    Returns the claimed firings by trigger type, the number of triggers selected, and the
    cursor for the next batch. Resuming from the cursor avoids rescanning index entries left
    stale by earlier batches. Rows locked by another claim are skipped and left for a later one.
    """
    claimed: dict[ScheduledTriggerType, list[_ClaimedFiring]] = defaultdict(list)
    using = router.db_for_write(ScheduledTrigger)
    with transaction.atomic(using=using):
        # Subqueries hide the bounds from the planner. Given their values, it reads the index to
        # estimate the row count, which wastes the time the bounded scan saves.
        query: QuerySet[ScheduledTrigger] = ScheduledTrigger.objects.select_for_update(
            skip_locked=True
        ).extra(where=['"next_fire_at" <= (SELECT %s::timestamptz)'], params=[due_by])
        if after is not None:
            query = query.extra(
                where=['ROW("next_fire_at", "id") > ROW((SELECT %s::timestamptz), %s)'],
                params=[after.fire_at, after.id],
            )
        due = list(query.order_by("next_fire_at", "id")[:TICK_BATCH_SIZE])
        if not due:
            return claimed, 0, after
        last = due[-1]
        assert last.next_fire_at is not None
        cursor = _Cursor(fire_at=last.next_fire_at, id=last.id)
        for trigger in due:
            scheduled_for = trigger.next_scheduled_for
            fire_at = trigger.next_fire_at
            assert scheduled_for is not None and fire_at is not None
            # A bad row must not fail the batch: it would stay due and block every tick.
            try:
                trigger_type = ScheduledTriggerType(trigger.trigger_type)
                # Uses the trigger type's current spread window, so a changed window takes
                # effect from each trigger's next firing.
                try:
                    offset = offset_of(trigger)
                except NoRegistrationExistsError:
                    # Without a registered handler this firing is lost when dispatched, but the
                    # trigger is kept so it fires once the handler is deployed.
                    offset = timedelta(0)
                # A scheduled time that has passed is still next if its offset firing hasn't.
                trigger.next_scheduled_for = advance(trigger, scheduled_for, now - offset)
                trigger.next_fire_at = trigger.next_scheduled_for + offset
                missed, missed_count_capped = missed_between(
                    trigger, scheduled_for, trigger.next_scheduled_for
                )
            except Exception:
                logger.exception(
                    "cadence.trigger.unschedulable",
                    extra={"trigger_id": trigger.id, "trigger_type": trigger.trigger_type},
                )
                trigger.next_scheduled_for = None
                trigger.next_fire_at = None
                continue
            claimed[trigger_type].append(
                _ClaimedFiring(
                    firing=TriggerFiring(
                        organization_id=trigger.organization_id,
                        trigger_type=trigger_type,
                        target_id=trigger.target_id,
                        scheduled_for=scheduled_for,
                        next_scheduled_for=trigger.next_scheduled_for,
                    ),
                    fire_at=fire_at,
                    date_updated=trigger.date_updated,
                    missed=missed,
                    missed_count_capped=missed_count_capped,
                )
            )
        _save_next_fire(using, due)
    return claimed, len(due), cursor


def _save_next_fire(using: str, triggers: Sequence[ScheduledTrigger]) -> None:
    """
    Save the triggers' next_scheduled_for and next_fire_at in one query. This is what
    bulk_update does, but about 3x faster: building bulk_update's CASE expressions took
    longer than running the query.
    """
    with connections[using].cursor() as cursor:
        cursor.execute(
            """
            UPDATE cadence_scheduledtrigger AS t
            SET next_scheduled_for = v.next_scheduled_for, next_fire_at = v.next_fire_at
            FROM unnest(%s::bigint[], %s::timestamptz[], %s::timestamptz[])
                AS v(id, next_scheduled_for, next_fire_at)
            WHERE t.id = v.id
            """,
            [
                [t.id for t in triggers],
                [t.next_scheduled_for for t in triggers],
                [t.next_fire_at for t in triggers],
            ],
        )


def _dispatch(claimed: dict[ScheduledTriggerType, list[_ClaimedFiring]], source: str) -> None:
    """
    Dispatch each trigger type's firings, after dropping those whose targets no longer exist.
    One type's failure doesn't affect others.
    """
    for trigger_type, claimed_firings in claimed.items():
        dispatched_at = timezone.now()
        tags = {"trigger_type": trigger_type.value, "source": source}
        claimed_firings = _drop_missing_targets(trigger_type, claimed_firings, dispatched_at, tags)
        if not claimed_firings:
            continue
        missed = sum(c.missed for c in claimed_firings)
        if missed:
            metrics.incr("cadence.trigger.missed", amount=missed, tags=tags, sample_rate=1.0)
        capped = sum(int(c.missed_count_capped) for c in claimed_firings)
        if capped:
            logger.warning(
                "cadence.trigger.missed_count_capped",
                extra={
                    "trigger_type": trigger_type.value,
                    "capped_firings": capped,
                    "limit_per_firing": MAX_MISSED_CRON_FIRINGS,
                },
            )
        for claimed_firing in claimed_firings:
            # Measured from when the firing was due, so a trigger's offset isn't counted as lag.
            metrics.distribution(
                "cadence.trigger.dispatch_lag",
                (dispatched_at - claimed_firing.fire_at).total_seconds(),
                tags=tags,
                unit="second",
            )
        _dispatch_type(trigger_type, [c.firing for c in claimed_firings], tags)


def _drop_missing_targets(
    trigger_type: ScheduledTriggerType,
    claimed_firings: list[_ClaimedFiring],
    now: datetime,
    tags: dict[str, str],
) -> list[_ClaimedFiring]:
    """
    Delete the triggers among `claimed_firings` whose targets the trigger type reports
    missing, and return the rest. Opportunistic: triggers set within the settle window aren't
    checked, and if anything fails, nothing is dropped.
    """
    if not options.get("cadence.missing_target_check.enabled"):
        return claimed_firings
    settled_before = now - MISSING_TARGET_CHECK_SETTLE_WINDOW
    targets = [
        TriggerTarget(organization_id=c.firing.organization_id, target_id=c.firing.target_id)
        for c in claimed_firings
        if c.date_updated <= settled_before
    ]
    if not targets:
        return claimed_firings
    try:
        handler = trigger_type_registry.get(trigger_type)
    except NoRegistrationExistsError:
        # Dispatching reports the missing registration.
        return claimed_firings
    try:
        with metrics.timer("cadence.trigger.missing_target_check_duration", tags=tags):
            # Ignore any target the check returns that it wasn't asked about.
            missing = set(handler.find_missing(targets)) & set(targets)
        if not missing:
            return claimed_firings
        ScheduledTrigger.objects.filter(
            reduce(
                operator.or_,
                (
                    Q(organization_id=target.organization_id, target_id=target.target_id)
                    for target in missing
                ),
            ),
            trigger_type=trigger_type,
            # A trigger set during the check wasn't checked, so it's kept.
            date_updated__lte=settled_before,
        ).delete()
    except Exception:
        metrics.incr("cadence.trigger.missing_target_check_failed", tags=tags)
        logger.exception(
            "cadence.trigger.missing_target_check_failed",
            extra={"trigger_type": trigger_type.value, "target_count": len(targets)},
        )
        return claimed_firings
    metrics.incr("cadence.trigger.missing_target_deleted", amount=len(missing), tags=tags)
    logger.info(
        "cadence.trigger.missing_target_deleted",
        extra={"trigger_type": trigger_type.value, "missing_count": len(missing)},
    )
    return [
        c
        for c in claimed_firings
        if TriggerTarget(organization_id=c.firing.organization_id, target_id=c.firing.target_id)
        not in missing
    ]


def _dispatch_type(
    trigger_type: ScheduledTriggerType, firings: Sequence[TriggerFiring], tags: dict[str, str]
) -> None:
    try:
        with metrics.timer("cadence.trigger.dispatch_duration", tags=tags):
            trigger_type_registry.get(trigger_type).dispatch(firings)
    except Exception:
        metrics.incr("cadence.trigger.dispatch_failed", amount=len(firings), tags=tags)
        logger.exception(
            "cadence.trigger.dispatch_failed",
            extra={"trigger_type": trigger_type.value, "firing_count": len(firings)},
        )
    else:
        metrics.incr("cadence.trigger.dispatched", amount=len(firings), tags=tags, sample_rate=1.0)
