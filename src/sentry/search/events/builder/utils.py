from datetime import datetime, timedelta
from typing import Callable


def remove_minutes(timestamp, floor=True):
    if floor:
        return datetime(timestamp.year, timestamp.month, timestamp.day, timestamp.hour)
    else:
        return datetime(timestamp.year, timestamp.month, timestamp.day, timestamp.hour) + timedelta(
            hours=1
        )


def remove_hours(timestamp, floor=True):
    if floor:
        return datetime(timestamp.year, timestamp.month, timestamp.day)
    else:
        return datetime(timestamp.year, timestamp.month, timestamp.day) + timedelta(days=1)


def adjust_datetime_to_granularity(timestamp: datetime, granularity_seconds: int):
    """
    Adjusts a datetime (down) to the boundary of a specified granularity.

    When storing events at a certain granularity the timestamp is truncated to the specified granularity.
    For example, if we store events at a granularity of 1 hour, the timestamp will be truncated to the beginning of the
    hour.

    In a query we might need to adjust the start/end interval to match the granularity of the query.
    This function returns the timestamp adjusted down to the specified granularity

    Examples:
        12 May 10:25:20, minute -> 12 May 10:25:00
        12 May 10:25:20, hour -> 12 May 10:00:00
        12 May 10:25:20, day -> 12 May 00:00:00
    """

    if granularity_seconds == 60:
        return timestamp.replace(second=0, microsecond=0)
    elif granularity_seconds == 3600:
        return timestamp.replace(minute=0, second=0, microsecond=0)
    elif granularity_seconds == 86400:
        return timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        raise NotImplementedError(f"Granularity {granularity_seconds} not supported")


def optimal_granularity_for_date_range(start: datetime, end: datetime) -> int:
    duration = (end - start).total_seconds()

    near_midnight: Callable[[datetime], bool] = lambda time: (
        time.minute <= 30 and time.hour == 0
    ) or (time.minute >= 30 and time.hour == 23)
    near_hour: Callable[[datetime], bool] = lambda time: time.minute <= 15 or time.minute >= 45

    if (
        # precisely going hour to hour
        start.minute
        == end.minute
        == start.second
        == end.second
        == duration % 3600
        == 0
    ):
        # we're going from midnight -> midnight which aligns with our daily buckets
        if start.hour == end.hour == duration % 86400 == 0:
            granularity = 86400
        # we're roughly going from start of hour -> next which aligns with our hourly buckets
        else:
            granularity = 3600
    elif (
        # Its over 30d, just use the daily granularity
        duration
        >= 86400 * 30
    ):
        granularity = 86400
    elif (
        # more than 3 days
        duration
        >= 86400 * 3
    ):
        # Allow 30 minutes for the daily buckets
        if near_midnight(start) and near_midnight(end):
            granularity = 86400
        else:
            granularity = 3600
    elif (
        # more than 12 hours
        (duration >= 3600 * 12)
        # Allow 15 minutes for the hourly buckets
        and near_hour(start)
        and near_hour(end)
    ):
        granularity = 3600
    else:
        granularity = 60

    return granularity
