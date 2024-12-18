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


def parse_ipv4(value: str) -> str | None:
    """Validates an IPv4 address"""
    if value == "":
        return None
    try:
        ipaddress.IPv4Address(value)
        return value
    except ipaddress.AddressValueError:
        raise CouldNotParseValue("Invalid IPv4")


def parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise CouldNotParseValue("Failed to parse uuid.")
