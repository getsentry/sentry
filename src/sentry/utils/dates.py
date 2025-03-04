import logging
import re
import zoneinfo
from datetime import UTC, date, datetime, timedelta
from typing import Any, overload

from dateutil.parser import ParserError, parse
from django.http.request import HttpRequest
from django.utils.timezone import is_aware, make_aware

from sentry import quotas
from sentry.constants import MAX_ROLLUP_POINTS

epoch = datetime(1970, 1, 1, tzinfo=UTC)

# Factory is an obscure GMT alias
AVAILABLE_TIMEZONES = frozenset(zoneinfo.available_timezones() - {"Factory"})

logger = logging.getLogger("sentry.utils.dates")


def ensure_aware(value: datetime) -> datetime:
    """
    Ensures the datetime is an aware datetime.
    """
    if is_aware(value):
        return value
    return make_aware(value)


@overload
def to_datetime(value: None) -> None: ...


@overload
def to_datetime(value: float | int) -> datetime: ...


def to_datetime(value: float | int | None) -> datetime | None:
    """
    Convert a POSIX timestamp to a time zone aware datetime.

    The timestamp value must be a numeric type (either a integer or float,
    since it may contain a fractional component.)
    """
    if value is None:
        return None

    return epoch + timedelta(seconds=value)


def date_to_utc_datetime(d: date) -> datetime:
    """Convert a `date` to an aware `datetime`."""
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


def floor_to_utc_day(value: datetime) -> datetime:
    """Floors a given datetime to UTC midnight."""
    return value.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)


def parse_date(datestr: str, timestr: str) -> datetime | None:
    # format is Y-m-d
    if not (datestr or timestr):
        return None
    if not timestr:
        return datetime.strptime(datestr, "%Y-%m-%d")

    datetimestr = datestr.strip() + " " + timestr.strip()
    try:
        return datetime.strptime(datetimestr, "%Y-%m-%d %I:%M %p")
    except Exception:
        try:
            return parse(datetimestr)
        except Exception:
            return None


def parse_timestamp(value: datetime | int | float | str | bytes | None) -> datetime | None:
    # TODO(mitsuhiko): merge this code with coreapis date parser
    if not value:
        return None
    elif isinstance(value, datetime):
        return value
    elif isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, UTC)

    try:
        if isinstance(value, bytes):
            value = value.decode()
        return parse(value, ignoretz=True).replace(tzinfo=UTC)
    except (ParserError, ValueError):
        logger.exception("parse_timestamp")
        return None


def parse_stats_period(period: str) -> timedelta | None:
    """Convert a value such as 1h into a proper timedelta."""
    m = re.match(r"^(\d+)([hdmsw]?)$", period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    if not unit:
        unit = "s"
    try:
        return timedelta(
            **{
                {"h": "hours", "d": "days", "m": "minutes", "s": "seconds", "w": "weeks"}[
                    unit
                ]: value
            }
        )
    except OverflowError:
        return timedelta.max


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
    date_range: timedelta,
    default_interval: None | str,
    error: Exception,
    top_events: int = 0,
) -> int:
    if default_interval is None:
        default_interval = get_interval_from_range(date_range, False)

    interval = parse_stats_period(request.GET.get("interval", default_interval))
    if interval is None:
        interval = timedelta(hours=1)
    validate_interval(interval, error, date_range, top_events)

    return int(interval.total_seconds())


def validate_interval(
    interval: timedelta, error: Exception, date_range: timedelta, top_events: int
) -> None:
    if interval.total_seconds() <= 0:
        raise error.__class__("Interval cannot result in a zero duration.")

    # When top events are present, there can be up to 5x as many points
    max_rollup_points = MAX_ROLLUP_POINTS if top_events == 0 else MAX_ROLLUP_POINTS / top_events

    if interval.total_seconds() > date_range.total_seconds():
        raise error.__class__("Interval cannot be larger than the date range.")

    if date_range.total_seconds() / interval.total_seconds() > max_rollup_points:
        raise error


def outside_retention_with_modified_start(
    start: datetime, end: datetime, organization: Any
) -> tuple[bool, datetime]:
    """
    Check if a start-end datetime range is outside an
    organizations retention period. Returns an updated
    start datetime if start is out of retention.
    """
    retention = quotas.backend.get_event_retention(organization=organization)
    if not retention:
        return False, start

    # Need to support timezone-aware and naive datetimes since
    # Snuba API only deals in naive UTC
    now = datetime.now(UTC) if start.tzinfo else datetime.utcnow()
    start = max(start, now - timedelta(days=retention))

    return start > end, start


def get_timezone_choices() -> list[tuple[str, str]]:
    build_results = []
    for tz in AVAILABLE_TIMEZONES:
        now = datetime.now(zoneinfo.ZoneInfo(tz))
        offset = now.strftime("%z")
        build_results.append((int(offset), tz, f"(UTC{offset}) {tz}"))
    build_results.sort()

    results: list[tuple[str, str]] = []
    for item in build_results:
        results.append(item[1:])
    return results
