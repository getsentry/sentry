"""Aggregate visitor on row visitor module.

This is the primary module containing our memory-optimizations.  The logic is simple: looking at
aggregate-level data is memory intensive.  The solution: look at the row-level data instead.  But
how?  You aggregate the result of a conditional expression.

For example:

    `sum(column = value) != 0`

In this operation the column is not under any aggregate function.  So any expression we write
against it is necessarily considering row-wise data.  Further we place the row-wise condition
under an aggregate function and assert the truthy-ness of the aggregation (in this case we assert
its value is not the empty set).  We do this because we want to aggregate the results for every
row and not short-circuit at the first sight of a truthy value.  If we did not apply the aggregate
function then this operation would not match correctly across multiple rows for a given aggregation
key.

Every class and every method in this module is interested in one of two outcomes. Either the
aggregation of the row-wise condition visitor is 0 or not 0.  This works because we're looking
for presence in the set; not for conformity across all rows.
"""
from __future__ import annotations

from uuid import UUID

from snuba_sdk import Condition
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.conditions import (
    GenericBase,
    IPv4Scalar,
    StringArray,
    StringScalar,
    UUIDArray,
    UUIDScalar,
)
from sentry.replays.lib.new_query.utils import contains, does_not_contain


class SumOfIPv4Scalar(GenericBase):
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


class SumOfStringScalar(GenericBase):
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


class SumOfStringArray(GenericBase):
    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(StringArray.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringArray.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(StringArray.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(StringArray.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(StringArray.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(StringArray.visit_in(expression, value))


class SumOfUUIDArray(GenericBase):
    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return contains(UUIDArray.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return does_not_contain(UUIDArray.visit_eq(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return contains(UUIDArray.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return does_not_contain(UUIDArray.visit_in(expression, value))


class SumOfUUIDScalar(GenericBase):
    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return contains(UUIDScalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return does_not_contain(UUIDScalar.visit_eq(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return contains(UUIDScalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return does_not_contain(UUIDScalar.visit_in(expression, value))
