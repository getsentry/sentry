from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Identifier, Lambda, Op

from sentry.replays.lib.new_query.conditions import GenericBase


class TagScalar(GenericBase[str]):
    """Tag scalar condition class."""

    @staticmethod
    def visit_eq(column: str, value: str) -> Condition:
        return Condition(match_key_value_exact(column, value), Op.EQ, 1)

    @staticmethod
    def visit_neq(column: str, value: str) -> Condition:
        return Condition(match_key_value_exact(column, value), Op.EQ, 0)

    @staticmethod
    def visit_in(column: str, value: list[str]) -> Condition:
        return Condition(match_key_values_exact(column, value), Op.EQ, 1)

    @staticmethod
    def visit_not_in(column: str, value: list[str]) -> Condition:
        return Condition(match_key_values_exact(column, value), Op.EQ, 0)

    @staticmethod
    def visit_match(column: str, value: str) -> Condition:
        return Condition(match_key_value_wildcard(column, value), Op.EQ, 1)

    @staticmethod
    def visit_not_match(column: str, value: str) -> Condition:
        return Condition(match_key_value_wildcard(column, value), Op.EQ, 0)


def match_key_value_exact(key: str, value: str) -> Function:
    return Function("has", parameters=[_get_tag_values(key), value])


def match_key_values_exact(key: str, values: list[str]) -> Function:
    return Function("hasAny", parameters=[_get_tag_values(key), values])


def match_key_value_wildcard(key: str, value: str) -> Function:
    return Function(
        "arrayExists",
        parameters=[
            Lambda(["tag_value"], _search(value, Identifier("tag_value"))),
            _get_tag_values(key),
        ],
    )


def _get_tag_values(key: str) -> Function:
    return Function(
        "arrayFilter",
        parameters=[
            Lambda(["key", "mask"], Function("equals", parameters=[Identifier("mask"), 1])),
            Column("tv"),
            _bitmask_on_tag_key(key),
        ],
    )


def _bitmask_on_tag_key(key: str) -> Function:
    """Create a bit mask.

    Returns an array where the integer 1 represents a match.
        e.g.: [0, 0, 1, 0, 1, 0]
    """
    return Function(
        "arrayMap",
        parameters=[
            Lambda(["i", "key"], Function("equals", parameters=[Identifier("key"), key])),
            Function("arrayEnumerate", parameters=[Column("tk")]),
            Column("tk"),
        ],
    )


def _search(value: str, identifier: Identifier) -> Function:
    # XXX: We don't want the '^$' values at the beginning and end of
    # the regex since we want to find the pattern anywhere in the
    # message. Strip off here
    return Function("match", parameters=[identifier, f"(?i){value[1:-1]}"])
