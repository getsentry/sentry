from datetime import date, datetime, timedelta
from typing import Iterable, Tuple

from sentry.utils.dates import to_datetime, to_timestamp


def _to_interval(timestamp, duration):
    return to_datetime(timestamp - duration), to_datetime(timestamp)


def change(value, reference):
    """
    Calculate the relative change between a value and a reference point.
    """
    if not reference:  # handle both None and divide by zero case
        return None

    return ((value or 0) - reference) / float(reference)


def safe_add(x, y):
    """
    Adds two values which are either numeric types or None.

    - If both values are numeric, the result is the sum of those values.
    - If only one numeric value is provided, that value is returned.
    - If both values are None, then None is returned.
    """
    if x is not None and y is not None:
        return x + y
    elif x is not None:
        return x
    elif y is not None:
        return y
    else:
        return None


def clean_series(start: datetime, stop: datetime, rollup: int, series: Iterable[Tuple[int, int]]):
    """
    Validate a series, ensuring that it follows the specified rollup and
    boundaries. The start bound is inclusive, while the stop bound is
    exclusive (similar to the slice operation.)
    """
    start_timestamp = to_timestamp(start)
    stop_timestamp = to_timestamp(stop)

    result = []
    for i, (timestamp, value) in enumerate(series):
        assert timestamp == start_timestamp + rollup * i
        if timestamp >= stop_timestamp:
            break

        result.append((timestamp, value))

    return result


def take_max_n(x, y, n):
    series = x + y
    series.sort(key=lambda group_id__count: group_id__count[1], reverse=True)
    return series[:n]


def prepare_reports_verify_key():
    today = date.today()
    week = today - timedelta(days=today.weekday())
    return f"prepare_reports_completed:{week.isoformat()}"


def has_valid_aggregates(interval, project__report):
    project, report = project__report
    return any(bool(value) for value in report.aggregates)


def series_map(function, series):
    """
    Series: An array of (timestamp, value) tuples.Apply `function` on `value` of
    each tuple element in array.
    """
    return [(timestamp, function(value)) for timestamp, value in series]


def build_project_report():
    return None
