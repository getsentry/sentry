from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.usecases.query.conditions.base import ComputedBase


class SimpleAggregateDurationScalar(ComputedBase):
    """Duration scalar condition class."""

    @staticmethod
    def visit_eq(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.EQ, value)

    @staticmethod
    def visit_neq(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.NEQ, value)

    @staticmethod
    def visit_gt(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.GT, value)

    @staticmethod
    def visit_gte(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.GTE, value)

    @staticmethod
    def visit_lt(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.LT, value)

    @staticmethod
    def visit_lte(value: int) -> Condition:
        return Condition(aggregate_duration(), Op.LTE, value)

    @staticmethod
    def visit_in(value: list[int]) -> Condition:
        return Condition(aggregate_duration(), Op.IN, value)

    @staticmethod
    def visit_not_in(value: list[int]) -> Condition:
        return Condition(aggregate_duration(), Op.NOT_IN, value)


def aggregate_duration() -> Function:
    """Return a function which computes the duration of a replay."""
    return Function(
        "dateDiff",
        parameters=[
            "millisecond",
            Function("min", parameters=[Column("replay_start_timestamp")]),
            Function("max", parameters=[Column("timestamp")]),
        ],
    )
