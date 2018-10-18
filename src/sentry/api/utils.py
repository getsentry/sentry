from __future__ import absolute_import

import re
from datetime import timedelta

from django.utils import timezone

from sentry.search.utils import parse_datetime_string, InvalidQuery

MIN_STATS_PERIOD = timedelta(hours=1)
MAX_STATS_PERIOD = timedelta(days=90)


class InvalidParams(Exception):
    pass


def parse_stats_period(period):
    """
    Convert a value such as 1h into a
    proper timedelta.
    """
    m = re.match('^(\d+)([hdms]?)$', period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    if not unit:
        unit = 's'
    return timedelta(**{
        {'h': 'hours', 'd': 'days', 'm': 'minutes', 's': 'seconds'}[unit]: value,
    })


def get_date_range_from_params(params):
    # Returns (start, end) or raises an `InvalidParams` exception
    now = timezone.now()

    end = now
    start = now - MAX_STATS_PERIOD

    stats_period = params.get('statsPeriod')
    if stats_period is not None:
        stats_period = parse_stats_period(stats_period)
        if stats_period is None or stats_period < MIN_STATS_PERIOD or stats_period >= MAX_STATS_PERIOD:
            raise InvalidParams('Invalid statsPeriod')
        start = now - stats_period
    elif params.get('start') or params.get('end'):
        if not all([params.get('start'), params.get('end')]):
            raise InvalidParams('start and end are both required')
        try:
            start = parse_datetime_string(params['start'])
            end = parse_datetime_string(params['end'])
        except InvalidQuery as exc:
            raise InvalidParams(exc.message)
        if start > end:
            raise InvalidParams('start must be before end')

    return (start, end)
