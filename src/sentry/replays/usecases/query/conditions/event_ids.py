from __future__ import annotations

from uuid import UUID

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.new_query.utils import (
    contains,
    does_not_contain,
    to_uuid,
    translate_condition_to_function,
)
from sentry.replays.usecases.query.conditions.base import ComputedBase


class EventIdScalar(ComputedBase):
    """Duration scalar condition class."""

    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return Condition(
            Function(
                "or",
                [
                    translate_condition_to_function(
                        Condition(Column("fatal_id"), Op.EQ, to_uuid(value))
                    ),
                    translate_condition_to_function(
                        Condition(Column("error_id"), Op.EQ, to_uuid(value))
                    ),
                ],
            ),
            Op.EQ,
            1,
        )

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return Condition(
            Function(
                "and",
                [
                    Condition(Column("error_id"), Op.NEQ, to_uuid(value)),
                    Condition(Column("fatal_id"), Op.NEQ, to_uuid(value)),
                ],
            ),
            Op.EQ,
            1,
        )

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return Condition(
            Function(
                "or",
                [
                    Condition(Column("error_id"), Op.IN, to_uuid(value)),
                    Condition(Column("fatal_id"), Op.IN, to_uuid(value)),
                ],
            ),
            Op.EQ,
            1,
        )

    @staticmethod
    def visit_not_in(value: UUID) -> Condition:
        return Condition(
            Function(
                "and",
                [
                    Condition(Column("error_id"), Op.NOT_IN, to_uuid(value)),
                    Condition(Column("fatal_id"), Op.NOT_IN, to_uuid(value)),
                ],
            ),
            Op.EQ,
            1,
        )


class SumOfEventIdScalar(ComputedBase):
    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return contains(EventIdScalar.visit_eq(value))

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return does_not_contain(EventIdScalar.visit_eq(value))

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return contains(EventIdScalar.visit_in(value))

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return does_not_contain(EventIdScalar.visit_in(value))
