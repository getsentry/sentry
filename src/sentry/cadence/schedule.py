from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import islice, pairwise
from typing import Any, ClassVar
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from cronsim import CronSim, CronSimError

from sentry.cadence.models import ScheduledTrigger, ScheduleType

MIN_INTERVAL = timedelta(minutes=30)
MAX_INTERVAL = timedelta(weeks=1)

# How many upcoming runs of a cron expression are checked against MIN_INTERVAL.
CRON_SPACING_SAMPLE = 2000
_CRON_SPACING_START = datetime(2024, 1, 1)


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


@dataclass(frozen=True)
class CronSchedule:
    """
    Run on a five-field cron `expression`, evaluated in `timezone`. Always valid once
    constructed: the expression parses, the timezone exists, and runs are at least
    MIN_INTERVAL apart (checked over the next CRON_SPACING_SAMPLE runs).
    """

    schedule_type: ClassVar[ScheduleType] = ScheduleType.CRON

    expression: str
    timezone: str = "UTC"

    def __post_init__(self) -> None:
        error = _cron_error(self.expression, self.timezone)
        if error is not None:
            raise InvalidSchedule(error)

    def next_after(self, after: datetime) -> datetime:
        return _next_cron_after(self.expression, self.timezone, after)


def _next_cron_after(expression: str, timezone: str, after: datetime) -> datetime:
    local_after = after.astimezone(ZoneInfo(timezone))
    return next(CronSim(expression, local_after)).astimezone(UTC)


def _cron_error(expression: str, timezone: str) -> str | None:
    """Why a cron schedule is invalid, or None. Takes tens of ms: checks spacing of many runs."""
    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return f"Unknown timezone: {timezone}"
    try:
        runs = CronSim(expression, _CRON_SPACING_START.replace(tzinfo=tz))
    except CronSimError as exc:
        return f"Invalid cron expression {expression!r}: {exc}"
    for earlier, later in pairwise(islice(runs, CRON_SPACING_SAMPLE)):
        if later - earlier < MIN_INTERVAL:
            return f"Cron runs must be at least {MIN_INTERVAL} apart"
    return None


def every(interval: timedelta) -> IntervalSchedule:
    return IntervalSchedule(interval)


def cron(expression: str, timezone: str = "UTC") -> CronSchedule:
    return CronSchedule(expression, timezone)


type Schedule = IntervalSchedule | CronSchedule


def _without_validation[S: (IntervalSchedule, CronSchedule)](cls: type[S], **fields: Any) -> S:
    """
    Rebuild a schedule from storage without validating it again. Only validated schedules
    are stored (see api.set_schedule), and re-checking a cron schedule's spacing is slow.
    It also means tightening validation later doesn't break existing triggers.
    """
    schedule = object.__new__(cls)
    for name, value in fields.items():
        object.__setattr__(schedule, name, value)
    return schedule


def schedule_of(trigger: ScheduledTrigger) -> Schedule:
    """The Schedule a stored trigger runs on."""
    if trigger.schedule_type == ScheduleType.INTERVAL:
        assert trigger.interval is not None
        return _without_validation(IntervalSchedule, interval=trigger.interval)
    if trigger.schedule_type == ScheduleType.CRON:
        assert trigger.cron_expression is not None
        return _without_validation(
            CronSchedule, expression=trigger.cron_expression, timezone=trigger.timezone
        )
    raise ValueError(f"Unknown schedule type: {trigger.schedule_type}")


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
