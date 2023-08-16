from datetime import datetime, timedelta


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
