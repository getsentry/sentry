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
    return int(parse_float(value))


def parse_str(value: str) -> str:
    """Coerce to str or fail."""
    return value


def parse_ipv4(value: str) -> str:
    """Validates an IPv4 address"""
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
