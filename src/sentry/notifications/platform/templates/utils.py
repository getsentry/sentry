import zoneinfo
from datetime import datetime

from django.utils import dateformat

from sentry.utils.dates import parse_timestamp


def format_datetime(
    value: datetime | str | bytes | int | float,
    *,
    timezone_str: str | None = None,
    use_24_clock: bool = False,
) -> str:
    """
    Format a datetime value into a human-readable string.

    Arguments are JSON-serializable for compatibility with the notification platform.
    Ideally, templates will have user preferences as part of their data for rendering
    datetimes, though these are optional for routing to teams/channels.

    Args:
        value: Anything ``parse_timestamp`` can handle (datetime, ISO string, POSIX timestamp).
        timezone_str: IANA timezone name (e.g. ``"America/Los_Angeles"``).
            Converts the value before formatting; defaults to UTC when ``None``.
        use_24_clock: When ``True``, times render as ``"16:00"`` instead of ``"4 p.m."``.
    """
    dt = value if isinstance(value, datetime) else parse_timestamp(value)
    if not dt:
        raise ValueError("Invalid value, could not create formatted string")
    tz = zoneinfo.ZoneInfo(timezone_str) if timezone_str else zoneinfo.ZoneInfo("UTC")
    fmt = "N j, Y, H:i e" if use_24_clock else "N j, Y, P e"
    return dateformat.format(dt.astimezone(tz), fmt)
