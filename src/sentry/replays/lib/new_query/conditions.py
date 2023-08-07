from __future__ import annotations

from typing import Generic, TypeVar, Union

from snuba_sdk import Column, Condition, Function, Op

Numeric = Union[int, float]
T = TypeVar("T")


class GenericBase(Generic[T]):
    @staticmethod
    def visit_eq(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_neq(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gt(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gte(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lt(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lte(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_match(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_match(column: str, value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_in(column: str, value: list[T]) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_in(column: str, value: list[T]) -> Condition:
        not_supported()


class BooleanScalar(GenericBase[bool]):
    """Boolean scalar column condition class."""

    @staticmethod
    def visit_eq(column: str, value: bool) -> Condition:
        return Condition(Column(column), Op.EQ, value)

    @staticmethod
    def visit_neq(column: str, value: bool) -> Condition:
        return Condition(Column(column), Op.NEQ, value)


class NumericScalar(GenericBase[Numeric]):
    """Scalar numeric column condition class."""

    @staticmethod
    def visit_eq(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.EQ, value)

    @staticmethod
    def visit_neq(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.NEQ, value)

    @staticmethod
    def visit_gt(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.GT, value)

    @staticmethod
    def visit_gte(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.GTE, value)

    @staticmethod
    def visit_lt(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.LT, value)

    @staticmethod
    def visit_lte(column: str, value: T) -> Condition:
        return Condition(Column(column), Op.LTE, value)

    @staticmethod
    def visit_in(column: str, value: list[T]) -> Condition:
        return Condition(Column(column), Op.IN, value)

    @staticmethod
    def visit_not_in(column: str, value: list[T]) -> Condition:
        return Condition(Column(column), Op.NOT_IN, value)


class StringScalar(GenericBase[str]):
    """Scalar string column condition class."""

    @staticmethod
    def visit_eq(column: str, value: str) -> Condition:
        return Condition(Column(column), Op.EQ, value)

    @staticmethod
    def visit_neq(column: str, value: str) -> Condition:
        return Condition(Column(column), Op.NEQ, value)

    @staticmethod
    def visit_match(column: str, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(Function("match", parameters=[Column(column), v]), Op.EQ, 1)

    @staticmethod
    def visit_not_match(column: str, value: str) -> Condition:
        v = f"(?i){value[1:-1]}"
        return Condition(Function("match", parameters=[Column(column), v]), Op.EQ, 0)

    @staticmethod
    def visit_in(column: str, value: list[str]) -> Condition:
        return Condition(Column(column), Op.IN, value)

    @staticmethod
    def visit_not_in(column: str, value: list[str]) -> Condition:
        return Condition(Column(column), Op.NOT_IN, value)


class IPv4Scalar(GenericBase[str]):
    """Scalar string column condition class."""

    @staticmethod
    def visit_eq(column: str, value: str) -> Condition:
        return Condition(Column(column), Op.EQ, Function("IPv4StringToNum", parameters=[value]))

    @staticmethod
    def visit_neq(column: str, value: str) -> Condition:
        return Condition(Column(column), Op.NEQ, Function("IPv4StringToNum", parameters=[value]))

    @staticmethod
    def visit_in(column: str, value: list[str]) -> Condition:
        values = [Function("IPv4StringToNum", parameters=[v]) for v in value]
        return Condition(Column(column), Op.IN, values)

    @staticmethod
    def visit_not_in(column: str, value: list[str]) -> Condition:
        values = [Function("IPv4StringToNum", parameters=[v]) for v in value]
        return Condition(Column(column), Op.NOT_IN, values)


class GenericComposite(GenericBase[T]):
    @staticmethod
    def visit_eq(column: str, value: T) -> Condition:
        return Condition(Function("has", parameters=[Column(column), value]), Op.EQ, 1)

    @staticmethod
    def visit_neq(column: str, value: T) -> Condition:
        return Condition(Function("has", parameters=[Column(column), value]), Op.EQ, 0)

    @staticmethod
    def visit_in(column: str, value: list[T]) -> Condition:
        return Condition(Function("hasAny", parameters=[Column(column), value]), Op.EQ, 1)

    @staticmethod
    def visit_not_in(column: str, value: list[T]) -> Condition:
        return Condition(Function("hasAny", parameters=[Column(column), value]), Op.EQ, 0)


class NumericComposite(GenericComposite[Numeric]):
    """Composite numeric column condition class."""


class StringComposite(GenericComposite[str]):
    """Composite string column condition class."""


def not_supported() -> None:
    """Raise not supported exception."""
    raise Exception("Not supported.")
