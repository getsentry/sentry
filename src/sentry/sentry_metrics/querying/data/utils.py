import math
from datetime import datetime, timedelta, timezone

from sentry.sentry_metrics.querying.types import ResultValue


def adjust_time_bounds_with_interval(
    start: datetime, end: datetime, interval_seconds: int
) -> tuple[datetime, datetime, int]:
    """
    Adjusts the supplied time bounds to the outermost multiples of the interval.

    For example, if 09:30 - 11:30 is supplied, with an interval of 1h, the resulting range will be 09:00 - 12:00.

    Returns:
        A tuple containing the adjusted start and end dates and the number of intervals.
    """
    if interval_seconds <= 0:
        raise Exception("Couldn't adjust the time bounds with an interval <= 0 seconds")

    if start.tzinfo is None:
        start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end.replace(tzinfo=timezone.utc)

    interval_start = int(start.timestamp() / interval_seconds) * interval_seconds
    interval_end = end.timestamp()

    seconds_to_cover = interval_end - interval_start

    last_incomplete_interval = 0
    # In case the difference in seconds it's not a multiple, we want to add one interval.
    if seconds_to_cover % interval_seconds != 0:
        last_incomplete_interval = 1

    num_intervals = int(seconds_to_cover / interval_seconds) + last_incomplete_interval

    adjusted_start = datetime.fromtimestamp(interval_start, timezone.utc)
    adjusted_end = adjusted_start + timedelta(seconds=interval_seconds * num_intervals)

    return adjusted_start, adjusted_end, num_intervals


def undefined_value_to_none(value: ResultValue) -> ResultValue:
    """
    Converts an undefined value to None or returns the original value.

    Returns:
        A converted ResultValue or None if the value is None.
    """
    if value is None:
        return None

    if is_undefined(value):
        return None

    return value


def is_undefined(value: ResultValue) -> bool:
    """
    Checks whether a value is undefined.

    Returns:
         A boolean set to True if the value is undefined, False otherwise.
    """
    if value is None:
        return False

    def _is_undefined(inner_value: int | float) -> bool:
        return math.isnan(inner_value) or math.isinf(inner_value)

    if isinstance(value, list):
        return any(map(lambda e: e is not None and _is_undefined(e), value))

    return _is_undefined(value)
