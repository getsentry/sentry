"""
The public interface to sentry.cadence. Code outside this package should import only
from this module, so everything else can change freely.

A trigger is identified by (organization, trigger type, target id), where the target id
says what the trigger is for; its meaning depends on the trigger type. Each trigger has a
schedule, and fires when the schedule comes due: the handler registered for its trigger
type dispatches a batch of firings. Dispatching should be cheap, such as scheduling a task
or publishing a Kafka message per firing; see `TriggerHandler` for the contract.

Firings are never dispatched before they are due (their scheduled time plus their offset
within their trigger type's spread window), and normally within 20 seconds of it, but can
be arbitrarily late while Cadence is behind. See "Timing" in README.md.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import assert_never

from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import (
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    missing_targets,
    register_trigger_type,
)
from sentry.cadence.schedule import (
    CronSchedule,
    IntervalSchedule,
    InvalidSchedule,
    Schedule,
    cron,
    every,
    min_gap,
    reschedule_for_new_interval,
    schedule_of,
)
from sentry.cadence.spread import offset_of

__all__ = (
    "CronSchedule",
    "IntervalSchedule",
    "InvalidSchedule",
    "Schedule",
    "ScheduledTriggerInfo",
    "ScheduledTriggerType",
    "TriggerHandler",
    "TriggerFiring",
    "TriggerTarget",
    "clear_schedule",
    "cron",
    "every",
    "get_schedules",
    "missing_targets",
    "register_trigger_type",
    "set_schedule",
)


@dataclass(frozen=True)
class ScheduledTriggerInfo:
    target_id: int
    schedule: Schedule
    # When the trigger next actually fires: its scheduled time plus the trigger's offset.
    # None if the trigger isn't scheduled to fire.
    next_fire_at: datetime | None
    # The next firing's scheduled time, which its TriggerFiring.scheduled_for will be.
    next_scheduled_for: datetime | None


def _to_info(trigger: ScheduledTrigger) -> ScheduledTriggerInfo:
    return ScheduledTriggerInfo(
        target_id=trigger.target_id,
        schedule=schedule_of(trigger),
        next_fire_at=trigger.next_fire_at,
        next_scheduled_for=trigger.next_scheduled_for,
    )


def _next_scheduled_for(
    schedule: Schedule, current: datetime | None, now: datetime, offset: timedelta
) -> datetime:
    match schedule:
        case IntervalSchedule(interval=interval):
            # As for cron, a scheduled time that has passed is only kept if its offset firing
            # hasn't. A changed offset could otherwise move that firing into the past.
            if current is not None and current + offset <= now:
                current = None
            return reschedule_for_new_interval(current, interval, now)
        case CronSchedule():
            # A scheduled time that has passed still fires if its offset firing hasn't.
            return schedule.next_after(now - offset)
        case _:
            assert_never(schedule)


def _apply_schedule(trigger: ScheduledTrigger, schedule: Schedule, now: datetime) -> None:
    trigger.schedule_type = schedule.schedule_type
    match schedule:
        case IntervalSchedule():
            trigger.interval_seconds = schedule.interval_seconds
            trigger.cron_expression = None
            trigger.timezone = "UTC"
        case CronSchedule():
            trigger.interval_seconds = None
            trigger.cron_expression = schedule.expression
            trigger.timezone = schedule.timezone
        case _:
            assert_never(schedule)
    trigger.min_gap_seconds = int(min_gap(schedule).total_seconds())
    offset = offset_of(trigger)
    trigger.next_scheduled_for = _next_scheduled_for(
        schedule, trigger.next_scheduled_for, now, offset
    )
    trigger.next_fire_at = trigger.next_scheduled_for + offset


def set_schedule(
    *,
    organization_id: int,
    trigger_type: ScheduledTriggerType,
    target_id: int,
    schedule: Schedule,
) -> ScheduledTriggerInfo:
    """
    Set the schedule of `target_id`'s trigger, creating the trigger or replacing its
    schedule. Setting the schedule it already has changes nothing, so this is safe to call
    repeatedly.

    - A new interval schedule is first scheduled for one interval from now.
    - A changed interval schedule keeps its pending firing if that is still ahead and
      scheduled within the new interval, otherwise it is next scheduled for one interval
      from now.
    - A new or changed cron schedule is next scheduled for its next cron time.

    A pending firing is one that hasn't fired, using the offset for the new schedule, so a
    change that moves it into the past skips it rather than firing it at once.

    Each firing may happen up to its trigger type's spread window after it is scheduled for;
    see `TriggerHandler`. Raises NoRegistrationExistsError if `trigger_type` has no
    registered handler, so a trigger is never created without knowing its spread window.
    """
    trigger_type = ScheduledTriggerType(trigger_type)
    for attempt in range(2):
        try:
            with transaction.atomic(using=router.db_for_write(ScheduledTrigger)):
                trigger = ScheduledTrigger.objects.select_for_update().get_or_none(
                    organization_id=organization_id,
                    trigger_type=trigger_type,
                    target_id=target_id,
                )
                if trigger is None:
                    trigger = ScheduledTrigger(
                        organization_id=organization_id,
                        trigger_type=trigger_type,
                        target_id=target_id,
                    )
                elif schedule_of(trigger) == schedule:
                    return _to_info(trigger)
                _apply_schedule(trigger, schedule, timezone.now())
                trigger.save()
                return _to_info(trigger)
        except IntegrityError:
            # A concurrent call created the trigger first; update it instead.
            if attempt:
                raise
    raise AssertionError("unreachable")


def clear_schedule(
    *, organization_id: int, trigger_type: ScheduledTriggerType, target_id: int
) -> bool:
    """Remove `target_id`'s trigger, and with it its schedule. Returns False if it had none."""
    deleted, _ = ScheduledTrigger.objects.filter(
        organization_id=organization_id, trigger_type=trigger_type, target_id=target_id
    ).delete()
    return deleted > 0


def get_schedules(
    *, organization_id: int, trigger_type: ScheduledTriggerType, target_ids: Iterable[int]
) -> dict[int, ScheduledTriggerInfo]:
    """The schedules of those `target_ids` that have one, keyed by target id."""
    triggers = ScheduledTrigger.objects.filter(
        organization_id=organization_id, trigger_type=trigger_type, target_id__in=list(target_ids)
    )
    return {trigger.target_id: _to_info(trigger) for trigger in triggers}
