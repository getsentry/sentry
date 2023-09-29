from __future__ import annotations

from typing import Any

from snuba_sdk import Condition

from sentry.replays.lib.new_query.conditions import not_supported


class ComputedBase:
    """Computed expression base column.

    Computed expressions are not passed as arguments to the condition visitor methods. They are
    computed on the fly within the visitor.
    """

    @staticmethod
    def visit_eq(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_neq(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_gt(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_gte(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_lt(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_lte(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_match(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_match(value: Any) -> Condition:
        not_supported()

    @staticmethod
    def visit_in(value: list[Any]) -> Condition:
        not_supported()

    @staticmethod
    def visit_not_in(value: list[Any]) -> Condition:
        not_supported()
