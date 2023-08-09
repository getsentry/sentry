from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.usecases.query.conditions.base import ComputedBase


class SimpleAggregateErrorIDScalar(ComputedBase[str]):
    """Error ids scalar condition class."""

    @staticmethod
    def visit_eq(value: str) -> Condition:
        return Condition(aggregate_sum_of_has(value), Op.GT, 0)

    @staticmethod
    def visit_neq(value: str) -> Condition:
        return Condition(aggregate_sum_of_has(value), Op.EQ, 0)

    @staticmethod
    def visit_in(value: list[str]) -> Condition:
        return Condition(aggregate_sum_of_has_any(value), Op.GT, 0)

    @staticmethod
    def visit_not_in(value: list[str]) -> Condition:
        return Condition(aggregate_sum_of_has_any(value), Op.EQ, 0)


def aggregate_sum_of_has(error_id: str) -> Function:
    return Function(
        "sum",
        parameters=[
            Function(
                "has",
                parameters=[
                    Column("_error_ids_hashed"),
                    Function("cityHash64", parameters=[Function("toUUID", parameters=[error_id])]),
                ],
            )
        ],
    )


def aggregate_sum_of_has_any(error_ids: list[str]) -> Function:
    return Function(
        "sum",
        parameters=[
            Function(
                "hasAny",
                parameters=[
                    Column("_error_ids_hashed"),
                    [
                        Function("cityHash64", parameters=[Function("toUUID", parameters=[eid])])
                        for eid in error_ids
                    ],
                ],
            )
        ],
    )
