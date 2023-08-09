from __future__ import annotations

from typing import Generic, TypeVar, Union
from uuid import UUID

from snuba_sdk import Condition, Function, Identifier, Lambda, Op
from snuba_sdk.expressions import Expression

Numeric = Union[int, float]
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
    """Boolean scalar column condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: bool) -> Condition:
        return Condition(expression, Op.NEQ, value)


class NumericScalar(GenericBase[Numeric]):
    """Scalar numeric column condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.NEQ, value)

    @staticmethod
    def visit_gt(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.GT, value)

    @staticmethod
    def visit_gte(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.GTE, value)

    @staticmethod
    def visit_lt(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.LT, value)

    @staticmethod
    def visit_lte(expression: Expression, value: T) -> Condition:
        return Condition(expression, Op.LTE, value)

    @staticmethod
    def visit_in(expression: Expression, value: list[T]) -> Condition:
        return Condition(expression, Op.IN, value)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[T]) -> Condition:
        return Condition(expression, Op.NOT_IN, value)


class StringScalar(GenericBase[str]):
    """Scalar string column condition class."""

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
    """Scalar UUID column condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.EQ, value)

    @staticmethod
    def visit_neq(expression: Expression, value: UUID) -> Condition:
        return Condition(expression, Op.NEQ, value)

    @staticmethod
    def visit_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.IN, value)

    @staticmethod
    def visit_not_in(expression: Expression, value: list[UUID]) -> Condition:
        return Condition(expression, Op.NOT_IN, value)


class IPv4Scalar(GenericBase[str]):
    """Scalar string column condition class."""

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


class GenericComposite(GenericBase[T]):
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


class NumericComposite(GenericComposite[Numeric]):
    """Composite numeric column condition class."""


class StringComposite(GenericComposite[str]):
    """Composite string column condition class."""

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


def not_supported() -> None:
    """Raise not supported exception."""
    raise Exception("Not supported.")
