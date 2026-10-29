from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar
from zoneinfo import ZoneInfo

from cronsim import CronSim

from sentry.cadence.models import ScheduledTrigger, ScheduleType

MIN_INTERVAL = timedelta(minutes=30)
MAX_INTERVAL = timedelta(weeks=1)


class InvalidSchedule(ValueError):
    pass


@dataclass(frozen=True)
class IntervalSchedule:
    """Run every `interval`. Always valid once constructed."""

    schedule_type: ClassVar[ScheduleType] = ScheduleType.INTERVAL

    interval: timedelta

    def __post_init__(self) -> None:
        if not MIN_INTERVAL <= self.interval <= MAX_INTERVAL:
            raise InvalidSchedule(
                f"Interval must be between {MIN_INTERVAL} and {MAX_INTERVAL}, got {self.interval}"
            )
        if self.interval % timedelta(seconds=1):
            raise InvalidSchedule("Interval must be a whole number of seconds")

    @property
    def interval_seconds(self) -> int:
        return int(self.interval.total_seconds())


def every(interval: timedelta) -> IntervalSchedule:
    return IntervalSchedule(interval)


# Will become `IntervalSchedule | CronSchedule`.
type Schedule = IntervalSchedule


def schedule_of(trigger: ScheduledTrigger) -> Schedule:
    """The Schedule a stored trigger runs on."""
    if trigger.schedule_type == ScheduleType.INTERVAL:
        assert trigger.interval is not None
        return IntervalSchedule(trigger.interval)
    raise NotImplementedError(f"No Schedule type for {trigger.schedule_type} triggers yet")


def _next_cron_after(cron_expression: str, tz: str, after: datetime) -> datetime:
    local_after = after.astimezone(ZoneInfo(tz))
    return next(CronSim(cron_expression, local_after)).astimezone(UTC)


def next_run_after(trigger: ScheduledTrigger, after: datetime) -> datetime:
    """The first run strictly after `after`, as if the schedule started at `after`."""
    if trigger.schedule_type == ScheduleType.INTERVAL:
        assert trigger.interval is not None
        return after + trigger.interval
    if trigger.schedule_type == ScheduleType.CRON:
        assert trigger.cron_expression is not None
        return _next_cron_after(trigger.cron_expression, trigger.timezone, after)
    raise ValueError(f"Unknown schedule type: {trigger.schedule_type}")


def advance(trigger: ScheduledTrigger, scheduled_for: datetime, now: datetime) -> datetime:
    """
    The next run after a run that was scheduled for `scheduled_for`.

    Interval schedules keep their cadence relative to `scheduled_for`. Runs that were
    missed (because `now` is already past them) are skipped rather than caught up.
    """
    if trigger.schedule_type == ScheduleType.INTERVAL:
        interval = trigger.interval
        assert interval is not None
        if scheduled_for > now:
            return scheduled_for + interval
        missed = (now - scheduled_for) // interval
        return scheduled_for + (missed + 1) * interval
    return next_run_after(trigger, max(scheduled_for, now))


def reschedule_for_new_interval(
    current_next_run: datetime | None,
    new_interval: timedelta,
    now: datetime,
    jitter: timedelta = timedelta(0),
) -> datetime:
    """
    Keep the existing next run if it would still happen within the new interval,
    otherwise start the new interval from `now`, delayed by `jitter`.
    """
    latest = now + new_interval
    if current_next_run is not None and current_next_run <= latest:
        return current_next_run
    return latest + jitter
