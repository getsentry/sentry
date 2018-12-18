from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry.search.utils import parse_datetime_string, InvalidQuery
from sentry.utils.dates import parse_stats_period

MIN_STATS_PERIOD = timedelta(hours=1)
MAX_STATS_PERIOD = timedelta(days=90)


class InvalidParams(Exception):
    pass


def get_date_range_from_params(params, optional=False):
    """
    Gets a date range from standard date range params we pass to the api.
    If `statsPeriod` is passed then convert to a time delta and make sure it
    fits within our min/max period length. Values are in the format
    <number><period_type>, where period type is one of `s` (seconds),
    `m` (minutes), `h` (hours) or `d` (days).
    :param params:
    If `start` end `end` are passed, validate them, convert to `datetime` and
    returns them if valid.
    :param optional: When True, if no params passed then return `(None, None)`.
    :return: A length 2 tuple containing start/end or raises an `InvalidParams`
    exception
    """
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
    elif optional:
        return None, None

    return start, end
