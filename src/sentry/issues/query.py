from __future__ import annotations

from snuba_sdk import Column, Function
from snuba_sdk.query import SelectableExpression


def manual_group_on_time_aggregation(rollup: int, time_column_alias: str) -> SelectableExpression:
    def rollup_agg(rollup_granularity: int, alias: str) -> SelectableExpression | None:
        if rollup_granularity == 60:
            return Function(
                "toUnixTimestamp", [Function("toStartOfMinute", [Column("timestamp")])], alias
            )
        elif rollup_granularity == 3600:
            return Function(
                "toUnixTimestamp", [Function("toStartOfHour", [Column("timestamp")])], alias
            )
        elif rollup_granularity == 3600 * 24:
            return Function(
                "toUnixTimestamp",
                [Function("toDateTime", [Function("toDate", [Column("timestamp")])])],
                alias,
            )
        else:
            return None

    # if we don't have an explicit function mapped to this rollup, we have to calculate it on the fly
    # multiply(intDiv(toUInt32(toUnixTimestamp(timestamp)), granularity)))
    synthetic_rollup = Function(
        "multiply",
        [
            Function(
                "intDiv",
                [
                    Function("toUInt32", [Function("toUnixTimestamp", [Column("timestamp")])]),
                    rollup,
                ],
            ),
            rollup,
        ],
        time_column_alias,
    )

    known_rollups = rollup_agg(rollup, time_column_alias)

    return known_rollups if known_rollups else synthetic_rollup
