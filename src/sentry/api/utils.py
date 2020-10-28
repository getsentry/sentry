from __future__ import absolute_import

from datetime import timedelta

import six
from django.utils import timezone

from sentry.search.utils import parse_datetime_string, InvalidQuery
from sentry.utils.dates import parse_stats_period


MAX_STATS_PERIOD = timedelta(days=90)


class InvalidParams(Exception):
    pass


def get_datetime_from_stats_period(stats_period, now=None):
    if now is None:
        now = timezone.now()
    stats_period = parse_stats_period(stats_period)
    if stats_period is None:
        raise InvalidParams("Invalid statsPeriod")
    return now - stats_period


def default_start_end_dates(now=None):
    if now is None:
        now = timezone.now()
    return now - MAX_STATS_PERIOD, now


def get_date_range_from_params(params, optional=False):
    """
    Gets a date range from standard date range params we pass to the api.

    If `statsPeriod` is passed then convert to a time delta and make sure it
    fits within our min/max period length. Values are in the format
    <number><period_type>, where period type is one of `s` (seconds),
    `m` (minutes), `h` (hours) or `d` (days).

    Similarly, `statsPeriodStart` and `statsPeriodEnd` allow for selecting a
    relative range, for example: 15 days ago through 8 days ago. This uses the same
    format as `statsPeriod`

    :param params:
    If `start` end `end` are passed, validate them, convert to `datetime` and
    returns them if valid.
    :param optional: When True, if no params passed then return `(None, None)`.
    :return: A length 2 tuple containing start/end or raises an `InvalidParams`
    exception
    """
    now = timezone.now()

    start, end = default_start_end_dates(now)

    stats_period = params.get("statsPeriod")
    stats_period_start = params.get("statsPeriodStart")
    stats_period_end = params.get("statsPeriodEnd")

    if stats_period is not None:
        start = get_datetime_from_stats_period(stats_period, now)

    elif stats_period_start or stats_period_end:
        if not all([stats_period_start, stats_period_end]):
            raise InvalidParams("statsPeriodStart and statsPeriodEnd are both required")
        start = get_datetime_from_stats_period(stats_period_start, now)
        end = get_datetime_from_stats_period(stats_period_end, now)

    elif params.get("start") or params.get("end"):
        if not all([params.get("start"), params.get("end")]):
            raise InvalidParams("start and end are both required")
        try:
            start = parse_datetime_string(params["start"])
            end = parse_datetime_string(params["end"])
        except InvalidQuery as e:
            raise InvalidParams(six.text_type(e))
    elif optional:
        return None, None

    if start > end:
        raise InvalidParams("start must be before end")

    return start, end
