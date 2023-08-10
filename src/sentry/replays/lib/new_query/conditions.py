"""Condition visitor module.

Each visitor (class) represents a unique data-type that is being acted upon.  For example, a class
titled "StringScalar" points to a column, function, or aggregation whose end product is of type
String.  The expression can then be acted upon using String like interactions.

Visitor classes are polymorphic on their data type, their methods are polymorphic on the operator,
and their values are polymorphic on data-type and operator.

It's important to note that condition visitors in this module (and elsewhere) do not assume the
origin of the data.  The same visitor may be applied to aggregated output as easily as its applied
to rows.

Every condition visitor must define a method for every operator supported by the caller.  A full
list of supported operations can be found in the "GenericBase" visitor.
"""
from __future__ import annotations

from typing import Generic, TypeVar
from uuid import UUID

from snuba_sdk import Condition, Function, Identifier, Lambda, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.utils import to_uuid, to_uuids

T = TypeVar("T")


class GenericBase(Generic[T]):
    @staticmethod
    def visit_eq(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_neq(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gt(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gte(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lt(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lte(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_match(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_match(expression: Expression, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_in(expression: Expression, value: list[T]) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_in(expression: Expression, value: list[T]) -> Condition:
        not_supported()


class BooleanScalar(GenericBase[bool]):
    """Boolean scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.NEQ, value)


class IntegerScalar(GenericBase[int]):
    """Integer scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.NEQ, value)

    @staticmethod
    def visit_gt(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.GT, value)

    @staticmethod
    def visit_gte(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.GTE, value)

    @staticmethod
    def visit_lt(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.LT, value)

    @staticmethod
    def visit_lte(expression: Expression, value: int) -> Condition:
        return Condition(expression, Op.LTE, value)

    @staticmethod
    def visit_in(expression: Expression, value: list[int]) -> Condition:
        return Condition(expression, Op.IN, value)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[int]) -> Condition:
        return Condition(expression, Op.NOT_IN, value)


class StringScalar(GenericBase[str]):
    """String scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return Condition(expression, Op.NEQ, value)

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(Function("match", parameters=[expression, v]), Op.EQ, 1)

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(Function("match", parameters=[expression, v]), Op.EQ, 0)

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return Condition(expression, Op.IN, value)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return Condition(expression, Op.NOT_IN, value)


class UUIDScalar(GenericBase[UUID]):
    """UUID scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.EQ, to_uuid(value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.NEQ, to_uuid(value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.IN, to_uuids(value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.NOT_IN, to_uuids(value))


class IPv4Scalar(GenericBase[str]):
    """IPv4 scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return Condition(expression, Op.EQ, Function("IPv4StringToNum", parameters=[value]))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return Condition(expression, Op.NEQ, Function("IPv4StringToNum", parameters=[value]))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        values = [Function("IPv4StringToNum", parameters=[v]) for v in value]
        return Condition(expression, Op.IN, values)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        values = [Function("IPv4StringToNum", parameters=[v]) for v in value]
        return Condition(expression, Op.NOT_IN, values)


class GenericArray(GenericBase[T]):
    @staticmethod
    def visit_eq(expression: Expression, value: T) -> Condition:
        return Condition(Function("has", parameters=[expression, value]), Op.EQ, 1)

    @staticmethod
    def visit_neq(expression: Expression, value: T) -> Condition:
        return Condition(Function("has", parameters=[expression, value]), Op.EQ, 0)

    @staticmethod
    def visit_in(expression: Expression, value: list[T]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, value]), Op.EQ, 1)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[T]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, value]), Op.EQ, 0)


class IntegerArray(GenericArray[int]):
    """Integer array condition class."""


class StringArray(GenericArray[str]):
    """String array condition class."""

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(
            Function(
                "arrayExists",
                parameters=[
                    Lambda(["item"], Function("match", parameters=[Identifier("item"), v])),
                    expression,
                ],
            ),
            Op.EQ,
            1,
        )

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(
            Function(
                "arrayExists",
                parameters=[
                    Lambda(["item"], Function("match", parameters=[Identifier("item"), v])),
                    expression,
                ],
            ),
            Op.EQ,
            0,
        )


class UUIDArray(GenericArray[UUID]):
    """UUID array condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return Condition(Function("has", parameters=[expression, to_uuid(value)]), Op.EQ, 1)

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return Condition(Function("has", parameters=[expression, to_uuid(value)]), Op.EQ, 0)

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, to_uuids(value)]), Op.EQ, 1)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, to_uuids(value)]), Op.EQ, 0)


def not_supported() -> None:
    """Raise not supported exception."""
    raise Exception("Not supported.")
