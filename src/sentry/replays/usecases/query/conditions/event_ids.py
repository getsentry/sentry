from __future__ import annotations

from uuid import UUID

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.new_query.utils import (
    contains,
    does_not_contain,
    to_uuid,
    to_uuids,
    translate_condition_to_function,
)
from sentry.replays.usecases.query.conditions.base import ComputedBase


class EventIdScalar(ComputedBase):
    """Duration scalar condition class."""

    event_id_columns: list[str] = []

    @classmethod
    def visit_eq(cls, value: UUID) -> Condition:
        return Condition(
            Function(
                "or",
                _make_conditions_from_column_names(cls.event_id_columns, Op.EQ, to_uuid(value)),
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
                    Condition(Column("error_id"), Op.IN, to_uuids(value)),
                    Condition(Column("fatal_id"), Op.IN, to_uuids(value)),
                ],
            ),
            Op.EQ,
            1,
        )

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return Condition(
            Function(
                "and",
                [
                    Condition(Column("error_id"), Op.NOT_IN, to_uuids(value)),
                    Condition(Column("fatal_id"), Op.NOT_IN, to_uuids(value)),
                ],
            ),
            Op.EQ,
            1,
        )


def _make_conditions_from_column_names(event_id_columns, operator, value):
    return [
        translate_condition_to_function(Condition(Column(column_name), operator, value))
        for column_name in event_id_columns
    ]


class ErrorIdScalar(EventIdScalar):
    event_id_columns = ["error_id", "fatal_id"]


class InfoIdScalar(EventIdScalar):
    event_id_columns = ["info_id", "debug_id"]


class SumOfErrorIdScalar(ComputedBase):
    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return contains(ErrorIdScalar.visit_eq(value))

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return does_not_contain(ErrorIdScalar.visit_eq(value))

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return contains(ErrorIdScalar.visit_in(value))

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return does_not_contain(ErrorIdScalar.visit_in(value))


class SumOfInfoIdScalar(ComputedBase):
    @staticmethod
    def visit_eq(value: UUID) -> Condition:
        return contains(InfoIdScalar.visit_eq(value))

    @staticmethod
    def visit_neq(value: UUID) -> Condition:
        return does_not_contain(InfoIdScalar.visit_eq(value))

    @staticmethod
    def visit_in(value: list[UUID]) -> Condition:
        return contains(InfoIdScalar.visit_in(value))

    @staticmethod
    def visit_not_in(value: list[UUID]) -> Condition:
        return does_not_contain(InfoIdScalar.visit_in(value))
