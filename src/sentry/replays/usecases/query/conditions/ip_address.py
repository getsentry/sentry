"""IP address condition module.

Replays store IPv4 addresses in "ip_address_v4" and IPv6 addresses in "ip_address_v6".  A row has
at most one of the two.  Each searched address is matched against the column for its version, and
a replay has no IP address when neither column is set on any of its rows.
"""

from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.new_query.conditions import IPScalar, IPv4Scalar, IPv6Scalar
from sentry.replays.lib.new_query.utils import (
    all_of,
    any_of,
    contains,
    does_not_contain,
    translate_condition_to_function,
)
from sentry.replays.usecases.query.conditions.base import ComputedBase

IPAddress = IPv4Address | IPv6Address

_COLUMNS: list[tuple[type[IPv4Address] | type[IPv6Address], Column, type[IPScalar]]] = [
    (IPv4Address, Column("ip_address_v4"), IPv4Scalar),
    (IPv6Address, Column("ip_address_v6"), IPv6Scalar),
]


# A row has at most one of the two columns set, so this is the row's address as text, or NULL when
# the row has none.  It is the same expression Snuba uses for "user.ip" on errors.
IP_ADDRESS_TEXT = Function(
    "coalesce",
    parameters=[
        Function("IPv4NumToString", parameters=[Column("ip_address_v4")]),
        Function("IPv6NumToString", parameters=[Column("ip_address_v6")]),
    ],
)


def _matches_address_text(pattern: str) -> Condition:
    """Return true if the row's address, as text, matches the wildcard regex.

    The search parser anchors the regex, so `10.0.*` arrives as `^10\\.0\\..*$` and matches
    10.0.0.1 but not 110.0.0.1.  "(?i)" lets uppercase IPv6 hex match ClickHouse's lowercase output.
    """
    return Condition(Function("match", parameters=[IP_ADDRESS_TEXT, f"(?i){pattern}"]), Op.EQ, 1)


def _does_not_contain_address(condition: Condition) -> Condition:
    """Return true if no row of the replay matches the condition, treating NULL as no match.

    "does_not_contain" checks "sum(condition) = 0".  That breaks when the column is NULL on every
    row: comparing NULL gives NULL, the sum of only NULLs is NULL, and "NULL = 0" is not true.

    For example, take an IPv4-only replay ("ip_address_v6" is NULL on every row) and the search
    `!user.ip:"2001:db8::1"`.  "sum(ip_address_v6 = toIPv6('2001:db8::1'))" is NULL, so
    "does_not_contain" would drop the replay even though it doesn't have that address.  Wrapping
    the sum in "ifNull(..., 0)" turns it into 0, and the replay matches.
    """
    return Condition(
        Function(
            "ifNull", parameters=[Function("sum", [translate_condition_to_function(condition)]), 0]
        ),
        Op.EQ,
        0,
    )


def _has_ip_address() -> Condition:
    """Return true if any row of the replay has an IPv4 or an IPv6 address.

    This is "!user.ip:''".  It checks each column for a non-NULL value on some row, and matches
    when either column has one.
    """
    return any_of(
        [contains(condition.visit_neq(column, None)) for _, column, condition in _COLUMNS]
    )


def _has_no_ip_address() -> Condition:
    """Return true if no row of the replay has an IPv4 or an IPv6 address.

    This is "user.ip:''".  It checks that each column is NULL on every row, and matches only when
    both columns are.
    """
    return all_of(
        [does_not_contain(condition.visit_neq(column, None)) for _, column, condition in _COLUMNS]
    )


def _column_for(value: IPAddress) -> tuple[Column, type[IPScalar]]:
    """Return the column that stores addresses of the value's version, and its condition class."""
    for version, column, condition in _COLUMNS:
        if isinstance(value, version):
            return column, condition
    raise TypeError(f"Unsupported IP address type: {type(value)}")


def _address_conditions(values: list[IPAddress | None]) -> list[Condition]:
    """Split the values by IP version and return one row-wise "IN" condition per column.

    A column only gets a condition when at least one value has its version.  "None" values (the
    empty search value) are skipped; callers handle them with "_has_ip_address" and
    "_has_no_ip_address".

    For example, the search `user.ip:[10.0.0.1, "2001:db8::1", 10.0.0.2]` returns
    "ip_address_v4 IN (toIPv4('10.0.0.1'), toIPv4('10.0.0.2'))" and
    "ip_address_v6 IN (toIPv6('2001:db8::1'))".
    """
    conditions = []
    for version, column, condition in _COLUMNS:
        addresses = [str(v) for v in values if isinstance(v, version)]
        if addresses:
            conditions.append(condition.visit_in(column, addresses))
    return conditions


class SumOfIPAddressScalar(ComputedBase):
    """Match IP addresses against the column for their version.

    IPv4 and IPv6 addresses are stored in different columns, "ip_address_v4" and "ip_address_v6".
    A row has at most one of them set, and the other is NULL.

    A single address only ever lives in one column, so "eq" and "neq" target that column alone.
    A list can mix versions, so "in" and "not_in" build one condition per column and combine them:
    a replay matches "in" when any column matches, and "not_in" only when no column matches.
    The empty value ("") means the replay has no address in either column.

    Wildcards ("match" and "not_match") can't be routed by version, because a pattern like "*1"
    could match either.  They match the address as text instead, from whichever column is set.
    """

    @staticmethod
    def visit_eq(value: IPAddress | None) -> Condition:
        if value is None:
            return _has_no_ip_address()
        column, condition = _column_for(value)
        return contains(condition.visit_eq(column, str(value)))

    @staticmethod
    def visit_neq(value: IPAddress | None) -> Condition:
        if value is None:
            return _has_ip_address()
        column, condition = _column_for(value)
        return _does_not_contain_address(condition.visit_eq(column, str(value)))

    @staticmethod
    def visit_in(value: list[IPAddress | None]) -> Condition:
        conditions = [contains(c) for c in _address_conditions(value)]
        if None in value:
            conditions.append(_has_no_ip_address())
        return any_of(conditions)

    @staticmethod
    def visit_not_in(value: list[IPAddress | None]) -> Condition:
        conditions = [_does_not_contain_address(c) for c in _address_conditions(value)]
        if None in value:
            conditions.append(_has_ip_address())
        return all_of(conditions)

    @staticmethod
    def visit_match(value: str) -> Condition:
        return contains(_matches_address_text(value))

    @staticmethod
    def visit_not_match(value: str) -> Condition:
        return _does_not_contain_address(_matches_address_text(value))
