"""IP address condition module.

Replays store IPv4 addresses in "ip_address_v4" and IPv6 addresses in "ip_address_v6".  A row has
at most one of the two.  Each searched address is matched against the column for its version, and
a replay has no IP address when neither column is set on any of its rows.
"""

from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address

from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry.replays.lib.new_query.conditions import IPScalar, IPv4Scalar, IPv6Scalar
from sentry.replays.lib.new_query.utils import (
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


def _any_of(conditions: list[Condition]) -> Condition:
    return conditions[0] if len(conditions) == 1 else Or(conditions=conditions)


def _all_of(conditions: list[Condition]) -> Condition:
    return conditions[0] if len(conditions) == 1 else And(conditions=conditions)


def _does_not_contain_address(condition: Condition) -> Condition:
    # Comparing a NULL column is NULL, so a replay without an address of this version sums to NULL.
    return Condition(
        Function(
            "ifNull", parameters=[Function("sum", [translate_condition_to_function(condition)]), 0]
        ),
        Op.EQ,
        0,
    )


def _has_ip_address() -> Condition:
    return _any_of([contains(scalar.visit_neq(column, None)) for _, column, scalar in _COLUMNS])


def _has_no_ip_address() -> Condition:
    return _all_of(
        [does_not_contain(scalar.visit_neq(column, None)) for _, column, scalar in _COLUMNS]
    )


def _column_for(value: IPAddress) -> tuple[Column, type[IPScalar]]:
    for version, column, scalar in _COLUMNS:
        if isinstance(value, version):
            return column, scalar
    raise TypeError(f"Unsupported IP address type: {type(value)}")


def _address_conditions(values: list[IPAddress | None]) -> list[Condition]:
    """Return one row-wise condition per column that one of the values is stored in."""
    conditions = []
    for version, column, scalar in _COLUMNS:
        addresses = [str(v) for v in values if isinstance(v, version)]
        if addresses:
            conditions.append(scalar.visit_in(column, addresses))
    return conditions


class SumOfIPAddressScalar(ComputedBase):
    """Match IP addresses against the column for their version.

    A single address only ever lives in one column, so "eq" and "neq" target that column alone.
    A list can mix versions, so "in" and "not_in" build one condition per column and combine them:
    a replay matches "in" when any column matches, and "not_in" only when no column matches.
    The empty value ("") means the replay has no address in either column.
    """

    @staticmethod
    def visit_eq(value: IPAddress | None) -> Condition:
        if value is None:
            return _has_no_ip_address()
        column, scalar = _column_for(value)
        return contains(scalar.visit_eq(column, str(value)))

    @staticmethod
    def visit_neq(value: IPAddress | None) -> Condition:
        if value is None:
            return _has_ip_address()
        column, scalar = _column_for(value)
        return _does_not_contain_address(scalar.visit_eq(column, str(value)))

    @staticmethod
    def visit_in(value: list[IPAddress | None]) -> Condition:
        conditions = [contains(c) for c in _address_conditions(value)]
        if None in value:
            conditions.append(_has_no_ip_address())
        return _any_of(conditions)

    @staticmethod
    def visit_not_in(value: list[IPAddress | None]) -> Condition:
        conditions = [_does_not_contain_address(c) for c in _address_conditions(value)]
        if None in value:
            conditions.append(_has_ip_address())
        return _all_of(conditions)
