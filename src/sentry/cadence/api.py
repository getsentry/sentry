"""
The public interface to sentry.cadence. Code outside this package should import only
from this module, so everything else can change freely.

Triggers run on a schedule and call a registered action, which should do nothing more
than schedule a task. See `TriggerAction` for the contract.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db import router, transaction
from django.utils import timezone

from sentry.cadence.models import ScheduledTrigger, ScheduledTriggerType
from sentry.cadence.registry import TriggerAction, register_trigger_action
from sentry.cadence.schedule import (
    IntervalSchedule,
    InvalidSchedule,
    Schedule,
    every,
    reschedule_for_new_interval,
    schedule_of,
)

__all__ = (
    "IntervalSchedule",
    "InvalidSchedule",
    "Schedule",
    "ScheduledTriggerInfo",
    "ScheduledTriggerType",
    "TriggerAction",
    "create_scheduled_trigger",
    "delete_scheduled_trigger",
    "every",
    "get_scheduled_trigger",
    "register_trigger_action",
    "update_schedule",
)

MAX_JITTER = timedelta(minutes=5)


@dataclass(frozen=True)
class ScheduledTriggerInfo:
    id: int
    trigger_type: ScheduledTriggerType
    schedule: Schedule
    # None if the trigger isn't scheduled to run.
    next_run_at: datetime | None


def _to_info(trigger: ScheduledTrigger) -> ScheduledTriggerInfo:
    return ScheduledTriggerInfo(
        id=trigger.id,
        trigger_type=ScheduledTriggerType(trigger.trigger_type),
        schedule=schedule_of(trigger),
        next_run_at=trigger.next_run_at,
    )


def _jitter(interval: timedelta) -> timedelta:
    """
    A random delay added when a trigger's cadence is (re)started, so triggers created
    together don't all run together. At most 10% of the interval, capped at MAX_JITTER.
    """
    max_jitter = min(interval / 10, MAX_JITTER)
    return timedelta(seconds=random.randint(0, int(max_jitter.total_seconds())))


def create_scheduled_trigger(
    *,
    organization_id: int,
    trigger_type: ScheduledTriggerType,
    schedule: Schedule,
) -> ScheduledTriggerInfo:
    """Create a trigger that first runs one interval (plus jitter) from now."""
    trigger = ScheduledTrigger.objects.create(
        organization_id=organization_id,
        trigger_type=ScheduledTriggerType(trigger_type),
        schedule_type=schedule.schedule_type,
        interval_seconds=schedule.interval_seconds,
        next_run_at=timezone.now() + schedule.interval + _jitter(schedule.interval),
    )
    return _to_info(trigger)


def get_scheduled_trigger(*, organization_id: int, trigger_id: int) -> ScheduledTriggerInfo | None:
    """Returns None if the trigger isn't in the organization."""
    trigger = ScheduledTrigger.objects.get_or_none(id=trigger_id, organization_id=organization_id)
    if trigger is None:
        return None
    return _to_info(trigger)


def update_schedule(
    *,
    organization_id: int,
    trigger_id: int,
    schedule: Schedule,
) -> ScheduledTriggerInfo | None:
    """
    Change a trigger's schedule. The pending run is kept if it would still happen within
    the new interval, otherwise the trigger next runs one interval (plus jitter) from now.

    Returns None if the trigger isn't in the organization.
    """
    with transaction.atomic(using=router.db_for_write(ScheduledTrigger)):
        trigger = ScheduledTrigger.objects.select_for_update().get_or_none(
            id=trigger_id, organization_id=organization_id
        )
        if trigger is None:
            return None
        trigger.schedule_type = schedule.schedule_type
        trigger.interval_seconds = schedule.interval_seconds
        trigger.cron_expression = None
        trigger.next_run_at = reschedule_for_new_interval(
            trigger.next_run_at,
            schedule.interval,
            timezone.now(),
            jitter=_jitter(schedule.interval),
        )
        trigger.save(
            update_fields=[
                "schedule_type",
                "interval_seconds",
                "cron_expression",
                "next_run_at",
                "date_updated",
            ]
        )
    return _to_info(trigger)


def delete_scheduled_trigger(*, organization_id: int, trigger_id: int) -> bool:
    """Delete a trigger. Returns False if it wasn't found in the organization."""
    deleted, _ = ScheduledTrigger.objects.filter(
        id=trigger_id, organization_id=organization_id
    ).delete()
    return deleted > 0
