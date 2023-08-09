from __future__ import annotations

from snuba_sdk import Condition, Function, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.conditions import (
    GenericBase,
    IPv4Scalar,
    StringComposite,
    StringScalar,
)
from sentry.replays.usecases.query.conditions.tags import TagScalar


class SumOfIPv4Scalar(GenericBase[str]):
    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(IPv4Scalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(IPv4Scalar.visit_eq(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(IPv4Scalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(IPv4Scalar.visit_in(expression, value))


class SumOfStringScalar(GenericBase[str]):
    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(StringScalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringScalar.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(StringScalar.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringScalar.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(StringScalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(StringScalar.visit_in(expression, value))


class SumOfStringComposite(GenericBase[str]):
    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(StringComposite.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringComposite.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(StringComposite.visit_match(expression, value).lhs)

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringComposite.visit_match(expression, value).lhs)

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(StringComposite.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(StringComposite.visit_in(expression, value))


class SumOfTagScalar(GenericBase[str]):
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


def contains(condition: Condition) -> Condition:
    """Return true if any of the rows in the aggregation set match the condition."""
    return Condition(Function("sum", parameters=[condition]), Op.GT, 0)


def does_not_contain(condition: Condition) -> Condition:
    """Return true if none of the rows in the aggregation set match the condition."""
    return Condition(Function("sum", parameters=[condition]), Op.EQ, 0)
