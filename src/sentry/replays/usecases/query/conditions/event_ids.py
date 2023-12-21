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


class InfoIdScalar(ComputedBase):
    """Look at both debug_id and info_id if info_id is queried"""

    event_id_columns: list[str] = ["info_id", "debug_id"]

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

    @classmethod
    def visit_neq(cls, value: UUID) -> Condition:
        return Condition(
            Function(
                "and",
                _make_conditions_from_column_names(cls.event_id_columns, Op.NEQ, to_uuid(value)),
            ),
            Op.EQ,
            1,
        )

    @classmethod
    def visit_in(cls, value: list[UUID]) -> Condition:
        return Condition(
            Function(
                "or",
                _make_conditions_from_column_names(
                    cls.event_id_columns, Op.IN, [str(v) for v in value]
                ),
            ),
            Op.EQ,
            1,
        )

    @classmethod
    def visit_not_in(cls, value: list[UUID]) -> Condition:
        return Condition(
            Function(
                "and",
                _make_conditions_from_column_names(
                    cls.event_id_columns, Op.NOT_IN, [str(v) for v in value]
                ),
            ),
            Op.EQ,
            1,
        )


class ErrorIdScalar(ComputedBase):
    """
    Look at fatal_id, error_id and the old error_ids array column if error_id is queried
    Note in the below functions we must nest our 'or' and 'and' functions because SnQL/snuba doesn't
    currently support passing more than 2 parameters to these functions
    (see https://getsentry.atlassian.net/browse/REQ3S-69)
    """

    event_id_columns: list[str] = ["error_id", "fatal_id"]

    @classmethod
    def visit_eq(cls, value: UUID) -> Condition:
        conditions = _make_conditions_from_column_names(cls.event_id_columns, Op.EQ, to_uuid(value))

        return Condition(
            Function("or", conditions),
            Op.EQ,
            1,
        )

    @classmethod
    def visit_neq(cls, value: UUID) -> Condition:
        conditions = _make_conditions_from_column_names(
            cls.event_id_columns, Op.NEQ, to_uuid(value)
        )

        return Condition(
            Function("and", conditions),
            Op.EQ,
            1,
        )

    @classmethod
    def visit_in(cls, value: list[UUID]) -> Condition:
        conditions = _make_conditions_from_column_names(
            cls.event_id_columns, Op.IN, [str(v) for v in value]
        )
        return Condition(
            Function("or", conditions),
            Op.EQ,
            1,
        )

    @classmethod
    def visit_not_in(cls, value: list[UUID]) -> Condition:
        conditions = _make_conditions_from_column_names(
            cls.event_id_columns, Op.NOT_IN, [str(v) for v in value]
        )
        return Condition(
            Function("and", conditions),
            Op.EQ,
            1,
        )


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


def _make_conditions_from_column_names(event_id_columns, operator, value):
    return [
        translate_condition_to_function(Condition(Column(column_name), operator, value))
        for column_name in event_id_columns
    ]
