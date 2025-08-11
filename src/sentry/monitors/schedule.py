from datetime import datetime

from cronsim import CronSim
from dateutil import rrule

from sentry.monitors.types import IntervalUnit, ScheduleConfig

SCHEDULE_INTERVAL_MAP: dict[IntervalUnit, int] = {
    "year": rrule.YEARLY,
    "month": rrule.MONTHLY,
    "week": rrule.WEEKLY,
    "day": rrule.DAILY,
    "hour": rrule.HOURLY,
    "minute": rrule.MINUTELY,
}


def get_next_schedule(
    reference_ts: datetime,
    schedule: ScheduleConfig,
) -> datetime:
    """
    Given the schedule type and schedule, determine the next timestamp for a
    schedule from the reference_ts

    Examples:

    >>> get_next_schedule('05:30', CrontabSchedule('0 * * * *'))
    >>> 06:00

    >>> get_next_schedule('05:30', CrontabSchedule('30 * * * *'))
    >>> 06:30

    >>> get_next_schedule('05:35', IntervalSchedule(interval=2, unit='hour'))
    >>> 07:35
    """
    # Ensure we clamp the expected time down to the minute, that is the level
    # of granularity we're able to support

    if schedule.type == "crontab":
        iter = CronSim(schedule.crontab, reference_ts)
        return next(iter).replace(second=0, microsecond=0)

    if schedule.type == "interval":
        rule = rrule.rrule(
            freq=SCHEDULE_INTERVAL_MAP[schedule.unit],
            interval=schedule.interval,
            dtstart=reference_ts,
            count=2,
        )
        return rule.after(reference_ts).replace(second=0, microsecond=0)

    raise NotImplementedError("unknown schedule_type")


def get_prev_schedule(
    start_ts: datetime,
    reference_ts: datetime,
    schedule: ScheduleConfig,
) -> datetime:
    """
    Given the schedule type and schedule, determine the previous timestamp for a
    schedule from the reference_ts. Requires `start_ts` to accurately compute

    Examples:

    >>> get_prev_schedule('01:30', '05:35', CrontabSchedule('0 * * * *'))
    >>> 05:00

    >>> get_prev_schedule('01:30', '05:30', CrontabSchedule('30 * * * *'))
    >>> 04:30

    >>> get_prev_schedule('01:30', '05:30', IntervalSchedule(interval=2, unit='hour'))
    >>> 03:30

    >>> get_prev_schedule('01:30', '05:35', IntervalSchedule(interval=2, unit='hour'))
    >>> 05:30
    """
    if schedule.type == "crontab":
        iter = CronSim(schedule.crontab, reference_ts, reverse=True)
        return next(iter).replace(second=0, microsecond=0)

    if schedule.type == "interval":
        rule = rrule.rrule(
            freq=SCHEDULE_INTERVAL_MAP[schedule.unit],
            interval=schedule.interval,
            dtstart=start_ts,
            until=reference_ts,
        )
        return rule.before(reference_ts).replace(second=0, microsecond=0)

    raise NotImplementedError("unknown schedule_type")
