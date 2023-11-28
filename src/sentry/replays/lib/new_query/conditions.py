"""Condition visitor module.

Each visitor (class) represents a unique data-type that is being acted upon.  For example, a class
titled "StringScalar" points to a column, function, or aggregation whose end product is of type
String.  The expression can then be interacted with using generic string operations.

Visitor classes are polymorphic on their data type, their methods are polymorphic on the operator,
and their values are polymorphic on data-type and operator.

It's important to note that condition visitors in this module (and elsewhere) do not assume the
origin of the data.  The same visitor may be applied to aggregated output as easily as its applied
to rows.

Every condition visitor must define a method for every operator supported by the caller.  A full
list of supported operations can be found in the "GenericBase" visitor.
"""
from __future__ import annotations

from typing import Any, NoReturn, TypeVar
from uuid import UUID

from snuba_sdk import Condition, Function, Identifier, Lambda, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.errors import OperatorNotSupported
from sentry.replays.lib.new_query.utils import to_uuid, to_uuids

T = TypeVar("T")


class GenericBase:
    @staticmethod
    def visit_eq(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_neq(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_gt(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_gte(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_lt(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_lte(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_match(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_match(expression: Expression, value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_in(expression: Expression, value: list[Any]) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_in(expression: Expression, value: list[Any]) -> Condition:
        not_supported()


class BooleanScalar(GenericBase):
    """Boolean scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.NEQ, value)


class IntegerScalar(GenericBase):
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


class StringScalar(GenericBase):
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


class UUIDScalar(GenericBase):
    """UUID scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.EQ, str(value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.NEQ, str(value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.IN, [str(v) for v in value])

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.NOT_IN, [str(v) for v in value])


class IPv4Scalar(GenericBase):
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


class GenericArray(GenericBase):
    @staticmethod
    def visit_eq(expression: Expression, value: Any) -> Condition:
        return Condition(Function("has", parameters=[expression, value]), Op.EQ, 1)

    @staticmethod
    def visit_neq(expression: Expression, value: Any) -> Condition:
        return Condition(Function("has", parameters=[expression, value]), Op.EQ, 0)

    @staticmethod
    def visit_in(expression: Expression, value: list[Any]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, value]), Op.EQ, 1)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[Any]) -> Condition:
        return Condition(Function("hasAny", parameters=[expression, value]), Op.EQ, 0)


class IntegerArray(GenericArray):
    """Integer array condition class."""


class StringArray(GenericArray):
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


class UUIDArray(GenericArray):
    """UUID array condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return GenericArray.visit_eq(expression, to_uuid(value))

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return GenericArray.visit_neq(expression, to_uuid(value))

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return GenericArray.visit_in(expression, to_uuids(value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return GenericArray.visit_not_in(expression, to_uuids(value))


def not_supported() -> NoReturn:
    """Raise not supported exception."""
    raise OperatorNotSupported("Not supported.")
