"""Parser module.

Functions in this module coerce external types to internal types.  Else they die.
"""

import ipaddress
import uuid

from sentry.replays.lib.new_query.errors import CouldNotParseValue


def parse_float(value: str) -> float:
    """Coerce to float or fail."""
    try:
        return float(value)
    except ValueError:
        raise CouldNotParseValue("Failed to parse float.")


def parse_int(value: str) -> int:
    """Coerce to int or fail."""
    try:
        return int(parse_float(value))
    except (ValueError, CouldNotParseValue):
        raise CouldNotParseValue("Failed to parse int.")


def parse_duration(value: str) -> int:
    """
    Assert that second resolution is given. The input and output of this fx is still in milliseconds, to match the
    output of api.event_search.parse_search_query
    """
    milliseconds = parse_int(value)
    if milliseconds % 1000:
        # TODO: remove once we support milliseconds.
        raise CouldNotParseValue(
            f"Replays only supports second-resolution timestamps at this time. Try '{milliseconds // 1000}s' instead."
        )
    return milliseconds


def parse_str(value: str) -> str:
    """Coerce to str or fail."""
    return value


def parse_ip_address(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Coerce to an IPv4 or IPv6 address or fail."""
    if value == "":
        return None
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        raise CouldNotParseValue("Invalid IP address")

    # ClickHouse can't parse zone ids, and ingestion never stores addresses that have one.
    if isinstance(address, ipaddress.IPv6Address) and address.scope_id is not None:
        raise CouldNotParseValue("Invalid IP address")
    return address


def parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise CouldNotParseValue("Failed to parse uuid.")
