from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.usecases.query.conditions.base import ComputedBase


class AggregateActivityScalar(ComputedBase):
    """Activity scalar condition class."""

    @staticmethod
    def visit_eq(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.EQ, value)

    @staticmethod
    def visit_neq(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.NEQ, value)

    @staticmethod
    def visit_gt(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.GT, value)

    @staticmethod
    def visit_gte(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.GTE, value)

    @staticmethod
    def visit_lt(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.LT, value)

    @staticmethod
    def visit_lte(value: int) -> Condition:
        return Condition(aggregate_activity(), Op.LTE, value)

    @staticmethod
    def visit_in(value: list[int]) -> Condition:
        return Condition(aggregate_activity(), Op.IN, value)

    @staticmethod
    def visit_not_in(value: list[int]) -> Condition:
        return Condition(aggregate_activity(), Op.NOT_IN, value)


def aggregate_activity() -> Function:
    """Return a function which computes the duration of a replay."""

    def sum_length_column(column_name: str) -> Function:
        return Function("sum", parameters=[Function("length", parameters=[Column(column_name)])])

    combined_weight_normalized = Function(
        "intDivOrZero",
        parameters=[
            Function(
                "plus",
                parameters=[
                    # Error weight.
                    Function("multiply", parameters=[sum_length_column("error_ids"), 25]),
                    # Page visited weight.
                    Function("multiply", parameters=[sum_length_column("urls"), 5]),
                ],
            ),
            10,
        ],
    )

    return Function(
        "floor",
        parameters=[
            Function(
                "greatest",
                parameters=[1, Function("least", parameters=[10, combined_weight_normalized])],
            )
        ],
    )
