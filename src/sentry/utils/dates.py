import re
from datetime import datetime, timedelta
from typing import Any, Mapping, Union

import pytz
from dateutil.parser import parse
from django.db import connections
from django.http.request import HttpRequest

from sentry import quotas
from sentry.constants import MAX_ROLLUP_POINTS

DATE_TRUNC_GROUPERS = {"date": "day", "hour": "hour", "minute": "minute"}

epoch = datetime(1970, 1, 1, tzinfo=pytz.utc)


def to_timestamp(value):
    """
    Convert a time zone aware datetime to a POSIX timestamp (with fractional
    component.)
    """
    return (value - epoch).total_seconds()


def to_datetime(value):
    """
    Convert a POSIX timestamp to a time zone aware datetime.

    The timestamp value must be a numeric type (either a integer or float,
    since it may contain a fractional component.)
    """
    if value is None:
        return None

    return epoch + timedelta(seconds=value)


def floor_to_utc_day(value):
    """
    Floors a given datetime to UTC midnight.
    """
    return value.astimezone(pytz.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def get_sql_date_trunc(col, db="default", grouper="hour"):
    conn = connections[db]
    method = DATE_TRUNC_GROUPERS[grouper]
    return conn.ops.date_trunc_sql(method, col)


def parse_date(datestr, timestr):
    # format is Y-m-d
    if not (datestr or timestr):
        return
    if not timestr:
        return datetime.strptime(datestr, "%Y-%m-%d")

    datetimestr = datestr.strip() + " " + timestr.strip()
    try:
        return datetime.strptime(datetimestr, "%Y-%m-%d %I:%M %p")
    except Exception:
        try:
            return parse(datetimestr)
        except Exception:
            return


def parse_timestamp(value):
    # TODO(mitsuhiko): merge this code with coreapis date parser
    if isinstance(value, datetime):
        return value
    elif isinstance(value, (int, float)):
        return datetime.utcfromtimestamp(value).replace(tzinfo=pytz.utc)
    value = (value or "").rstrip("Z").encode("ascii", "replace").split(b".", 1)
    if not value:
        return None
    try:
        rv = datetime.strptime(value[0].decode("ascii"), "%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None
    if len(value) == 2:
        try:
            rv = rv.replace(microsecond=int(value[1].ljust(6, b"0")[:6]))
        except ValueError:
            rv = None
    return rv.replace(tzinfo=pytz.utc)


def parse_stats_period(period):
    """
    Convert a value such as 1h into a
    proper timedelta.
    """
    m = re.match(r"^(\d+)([hdmsw]?)$", period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    if not unit:
        unit = "s"
    return timedelta(
        **{{"h": "hours", "d": "days", "m": "minutes", "s": "seconds", "w": "weeks"}[unit]: value}
    )


def get_interval_from_range(date_range: timedelta, high_fidelity: bool) -> str:
    # This matches what's defined in app/components/charts/utils.tsx

    if date_range >= timedelta(days=60):
        return "4h" if high_fidelity else "1d"

    if date_range >= timedelta(days=30):
        return "1h" if high_fidelity else "4h"

    if date_range > timedelta(days=1):
        return "30m" if high_fidelity else "1h"

    if date_range > timedelta(hours=1):
        return "1m" if high_fidelity else "5m"

    return "5m" if high_fidelity else "15m"


def get_rollup_from_request(
    request: HttpRequest,
    params: Mapping[str, Any],
    default_interval: Union[None, str],
    error: Exception,
    top_events: int = 0,
) -> int:
    date_range = params["end"] - params["start"]

    if default_interval is None:
        default_interval = get_interval_from_range(date_range, False)

    interval = parse_stats_period(request.GET.get("interval", default_interval))
    if interval is None:
        interval = timedelta(hours=1)
    if interval.total_seconds() <= 0:
        raise error.__class__("Interval cannot result in a zero duration.")

    # When top events are present, there can be up to 5x as many points
    max_rollup_points = MAX_ROLLUP_POINTS if top_events == 0 else MAX_ROLLUP_POINTS / top_events

    if date_range.total_seconds() / interval.total_seconds() > max_rollup_points:
        raise error
    return int(interval.total_seconds())


def outside_retention_with_modified_start(start, end, organization):
    """
    Check if a start-end datetime range is outside an
    organizations retention period. Returns an updated
    start datetime if start is out of retention.
    """
    retention = quotas.get_event_retention(organization=organization)
    if not retention:
        return False, start

    # Need to support timezone-aware and naive datetimes since
    # Snuba API only deals in naive UTC
    now = datetime.utcnow().astimezone(pytz.utc) if start.tzinfo else datetime.utcnow()
    start = max(start, now - timedelta(days=retention))

    return start > end, start
