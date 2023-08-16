from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Identifier, Lambda, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.conditions import GenericBase
from sentry.replays.lib.new_query.utils import contains, does_not_contain


class TagScalar(GenericBase):
    """Tag scalar condition class."""

    @staticmethod
    def visit_eq(expression_name: str, value: str) -> Condition:
        return Condition(_match_key_value_exact(expression_name, value), Op.EQ, 1)

    @staticmethod
    def visit_neq(expression_name: str, value: str) -> Condition:
        return Condition(_match_key_value_exact(expression_name, value), Op.EQ, 0)

    @staticmethod
    def visit_in(expression_name: str, value: list[str]) -> Condition:
        return Condition(_match_key_values_exact(expression_name, value), Op.EQ, 1)

    @staticmethod
    def visit_not_in(expression_name: str, value: list[str]) -> Condition:
        return Condition(_match_key_values_exact(expression_name, value), Op.EQ, 0)

    @staticmethod
    def visit_match(expression_name: str, value: str) -> Condition:
        return Condition(_match_key_value_wildcard(expression_name, value), Op.EQ, 1)

    @staticmethod
    def visit_not_match(expression_name: str, value: str) -> Condition:
        return Condition(_match_key_value_wildcard(expression_name, value), Op.EQ, 0)


class SumOfTagScalar(GenericBase):
    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(TagScalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(TagScalar.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(TagScalar.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(TagScalar.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(TagScalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(TagScalar.visit_in(expression, value))


def _match_key_value_exact(key: str, value: str) -> Function:
    return Function("has", parameters=[_get_tag_values(key), value])


def _match_key_values_exact(key: str, values: list[str]) -> Function:
    return Function("hasAny", parameters=[_get_tag_values(key), values])


def _match_key_value_wildcard(key: str, value: str) -> Function:
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
            Column("tags.value"),
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
            Function("arrayEnumerate", parameters=[Column("tags.key")]),
            Column("tags.key"),
        ],
    )


def _search(value: str, identifier: Identifier) -> Function:
    # XXX: We don't want the '^$' values at the beginning and end of
    # the regex since we want to find the pattern anywhere in the
    # message. Strip off here
    return Function("match", parameters=[identifier, f"(?i){value[1:-1]}"])
