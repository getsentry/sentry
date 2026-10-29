"""
The public interface to sentry.cadence. Code outside this package should import only
from this module, so everything else can change freely.

A schedule is identified by (organization, trigger type, target id), where the target id
says what the schedule is for (for SEER_WORKFLOW, a SeerWorkflowConfig id). When schedules
come due, the action registered for their trigger type is called with a batch of runs.
Actions should do nothing more than schedule a task or publish a Kafka message per run;
see `TriggerAction` for the contract.
"""

from __future__ import annotations

import random
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import assert_never

from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import TriggerAction, TriggerContext, register_trigger_action
from sentry.cadence.schedule import (
    CronSchedule,
    IntervalSchedule,
    InvalidSchedule,
    Schedule,
    cron,
    every,
    reschedule_for_new_interval,
    schedule_of,
)

__all__ = (
    "CronSchedule",
    "IntervalSchedule",
    "InvalidSchedule",
    "Schedule",
    "ScheduledTriggerInfo",
    "ScheduledTriggerType",
    "TriggerAction",
    "TriggerContext",
    "clear_schedule",
    "cron",
    "every",
    "get_schedules",
    "register_trigger_action",
    "set_schedule",
)

MAX_JITTER = timedelta(minutes=5)


@dataclass(frozen=True)
class ScheduledTriggerInfo:
    target_id: int
    schedule: Schedule
    # None if the trigger isn't scheduled to run.
    next_run_at: datetime | None


def _to_info(trigger: ScheduledTrigger) -> ScheduledTriggerInfo:
    return ScheduledTriggerInfo(
        target_id=trigger.target_id,
        schedule=schedule_of(trigger),
        next_run_at=trigger.next_run_at,
    )


def _jitter(interval: timedelta) -> timedelta:
    """
    A random delay added when an interval schedule's cadence is (re)started, so triggers
    created together don't all run together. At most 10% of the interval, capped at
    MAX_JITTER.
    """
    max_jitter = min(interval / 10, MAX_JITTER)
    return timedelta(seconds=random.randint(0, int(max_jitter.total_seconds())))


def _next_run(schedule: Schedule, current_next_run: datetime | None, now: datetime) -> datetime:
    match schedule:
        case IntervalSchedule(interval=interval):
            return reschedule_for_new_interval(
                current_next_run, interval, now, jitter=_jitter(interval)
            )
        case CronSchedule():
            return schedule.next_after(now)
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
    trigger.next_run_at = _next_run(schedule, trigger.next_run_at, now)


def set_schedule(
    *,
    organization_id: int,
    trigger_type: ScheduledTriggerType,
    target_id: int,
    schedule: Schedule,
) -> ScheduledTriggerInfo:
    """
    Schedule `target_id` to run on `schedule`, creating or replacing its schedule. Setting
    the schedule it already has changes nothing, so this is safe to call repeatedly.

    - A new interval schedule first runs one interval (plus jitter) from now.
    - A changed interval schedule keeps its pending run if that would still happen within
      the new interval, otherwise it next runs one interval (plus jitter) from now.
    - A new or changed cron schedule next runs at its next cron time.
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
    """Remove `target_id`'s schedule. Returns False if it had none."""
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
