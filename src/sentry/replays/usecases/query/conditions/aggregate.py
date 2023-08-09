from __future__ import annotations

from uuid import UUID

from snuba_sdk import Condition, Function, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.conditions import (
    GenericBase,
    IPv4Scalar,
    StringComposite,
    StringScalar,
    UUIDComposite,
)
from sentry.replays.lib.new_query.utils import translate_condition_to_function
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
        return contains(StringComposite.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringComposite.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(StringComposite.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(StringComposite.visit_in(expression, value))


class SumOfUUIDComposite(GenericBase[UUID]):
    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return contains(UUIDComposite.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return does_not_contain(UUIDComposite.visit_eq(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return contains(UUIDComposite.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return does_not_contain(UUIDComposite.visit_in(expression, value))


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
    return Condition(
        Function("sum", parameters=[translate_condition_to_function(condition)]), Op.GT, 0
    )


def does_not_contain(condition: Condition) -> Condition:
    """Return true if none of the rows in the aggregation set match the condition."""
    return Condition(
        Function("sum", parameters=[translate_condition_to_function(condition)]), Op.EQ, 0
    )
