from __future__ import annotations

from typing import Generic, TypeVar

from snuba_sdk import Condition

from sentry.replays.lib.new_query.conditions import not_supported

T = TypeVar("T")


class ComputedBase(Generic[T]):
    """Computed expression base column.

    Computed expressions are not passed as arguments to the condition visitor methods. They are
    computed on the fly within the visitor.
    """

    @staticmethod
    def visit_eq(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_neq(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gt(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_gte(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lt(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_lte(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_match(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_match(value: T) -> Condition:
        not_supported()

    @staticmethod
    def visit_in(value: list[T]) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_in(value: list[T]) -> Condition:
        not_supported()
