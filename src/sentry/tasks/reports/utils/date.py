from datetime import datetime, timedelta
from functools import partial

import pytz
from django.utils import dateformat

from sentry.app import tsdb
from sentry.tasks.reports.utils.util import clean_series
from sentry.utils.dates import to_datetime

date_format = partial(dateformat.format, format_string="F jS, Y")


def month_to_index(year, month):
    """
    Convert a year and month to a single value: the number of months between
    this month and 1 AD.

    This mainly exists to simplify doing month-based arithmetic (e.g. "three
    months ago") without having to manually handle wrapping around years, since
    timedelta doesn't accept a "months" parameter.
    """
    assert 12 >= month >= 1
    return (year - 1) * 12 + month - 1


def index_to_month(index):
    """
    The opposite companion to ``month_to_index``. Returns a (year, month)
    tuple.
    """
    return (index // 12) + 1, index % 12 + 1


def get_calendar_range(ignore__stop_time, months):
    _, stop_time = ignore__stop_time
    assert (
        stop_time.hour,
        stop_time.minute,
        stop_time.second,
        stop_time.microsecond,
        stop_time.tzinfo,
    ) == (0, 0, 0, 0, pytz.utc)

    last_day = stop_time - timedelta(days=1)

    stop_month_index = month_to_index(last_day.year, last_day.month)

    start_month_index = stop_month_index - months + 1
    return start_month_index, stop_month_index


def get_calendar_query_range(interval, months):
    start_month_index, _ = get_calendar_range(interval, months)

    start_time = datetime(day=1, tzinfo=pytz.utc, *index_to_month(start_month_index))

    return start_time, interval[1]


def clean_calendar_data(project, series, start, stop, rollup, timestamp=None):
    earliest = tsdb.get_earliest_timestamp(rollup, timestamp=timestamp)

    def remove_invalid_values(item):
        timestamp, value = item
        if timestamp < earliest:
            value = None
        elif to_datetime(timestamp) < project.date_added:
            value = None
        return (timestamp, value)

    return map(remove_invalid_values, clean_series(start, stop, rollup, series))
