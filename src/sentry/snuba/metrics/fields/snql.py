from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, TypeAlias

from snuba_sdk import Column, Function

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import (
    resolve_tag_key,
    resolve_tag_value,
)
from sentry.snuba.metrics.fields.histogram import MAX_HISTOGRAM_BUCKET, zoom_histogram

SnqlValue: TypeAlias = Function | Column | str | float | int


def _aggregation_on_session_status_func_factory(
    aggregate: str,
) -> Callable[[int, str, Sequence[int], str | None], Function]:
    def _snql_on_session_status_factory(
        org_id: int, session_status: str, metric_ids: Sequence[int], alias: str | None = None
    ) -> Function:
        return Function(
            aggregate,
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column(
                                    resolve_tag_key(
                                        UseCaseID.SESSIONS,
                                        org_id,
                                        "session.status",
                                    )
                                ),
                                resolve_tag_value(UseCaseID.SESSIONS, org_id, session_status),
                            ],
                        ),
                        Function("in", [Column("metric_id"), list(metric_ids)]),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_session_status_factory


def _aggregation_on_abnormal_mechanism_func_factory(
    org_id: int, abnormal_mechanism: Any, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    if isinstance(abnormal_mechanism, list):
        abnormal_mechanism_condition = Function(
            "in",
            [
                Column(
                    resolve_tag_key(
                        UseCaseID.SESSIONS,
                        org_id,
                        "abnormal_mechanism",
                    )
                ),
                [
                    resolve_tag_value(UseCaseID.SESSIONS, org_id, mechanism)
                    for mechanism in abnormal_mechanism
                ],
            ],
        )
    else:
        abnormal_mechanism_condition = Function(
            "equals",
            [
                Column(
                    resolve_tag_key(
                        UseCaseID.SESSIONS,
                        org_id,
                        "abnormal_mechanism",
                    )
                ),
                resolve_tag_value(UseCaseID.SESSIONS, org_id, abnormal_mechanism),
            ],
        )

    return Function(
        "uniqIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    abnormal_mechanism_condition,
                    Function("in", [Column("metric_id"), list(metric_ids)]),
                ],
            ),
        ],
        alias,
    )


def _counter_sum_aggregation_on_session_status_factory(
    org_id: int, session_status: str, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    return _aggregation_on_session_status_func_factory(aggregate="sumIf")(
        org_id, session_status, metric_ids, alias
    )


def _set_uniq_aggregation_on_session_status_factory(
    org_id: int, session_status: str, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    return _aggregation_on_session_status_func_factory(aggregate="uniqIf")(
        org_id, session_status, metric_ids, alias
    )


def all_sessions(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="init", metric_ids=metric_ids, alias=alias
    )


def all_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return uniq_aggregation_on_metric(metric_ids, alias)


def unhandled_sessions(
    org_id: int, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="unhandled", metric_ids=metric_ids, alias=alias
    )


def unhandled_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="unhandled", metric_ids=metric_ids, alias=alias
    )


def crashed_sessions(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def crashed_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def anr_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _aggregation_on_abnormal_mechanism_func_factory(
        org_id,
        abnormal_mechanism=["anr_foreground", "anr_background"],
        metric_ids=metric_ids,
        alias=alias,
    )


def foreground_anr_users(
    org_id: int, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    return _aggregation_on_abnormal_mechanism_func_factory(
        org_id,
        abnormal_mechanism="anr_foreground",
        metric_ids=metric_ids,
        alias=alias,
    )


def errored_preaggr_sessions(
    org_id: int, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="errored_preaggr", metric_ids=metric_ids, alias=alias
    )


def abnormal_sessions(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def abnormal_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def errored_all_users(org_id: int, metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="errored", metric_ids=metric_ids, alias=alias
    )


def uniq_aggregation_on_metric(metric_ids: Sequence[int], alias: str | None = None) -> Function:
    return Function(
        "uniqIf",
        [
            Column("value"),
            Function(
                "in",
                [
                    Column("metric_id"),
                    list(metric_ids),
                ],
            ),
        ],
        alias,
    )


def subtraction(arg1_snql: SnqlValue, arg2_snql: SnqlValue, alias: str | None = None) -> Function:
    return Function("minus", [arg1_snql, arg2_snql], alias)


def addition(arg1_snql: SnqlValue, arg2_snql: SnqlValue, alias: str | None = None) -> Function:
    return Function("plus", [arg1_snql, arg2_snql], alias)


def division_float(
    arg1_snql: SnqlValue, arg2_snql: SnqlValue, alias: str | None = None
) -> Function:
    return Function(
        "divide",
        # Clickhouse can manage divisions by 0, see:
        # https://clickhouse.com/docs/en/sql-reference/functions/arithmetic-functions/#dividea-b-a-b-operator
        [arg1_snql, arg2_snql],
        alias=alias,
    )


def complement(arg1_snql: SnqlValue, alias: str | None = None) -> Function:
    """(x) -> (1 - x)"""
    return Function("minus", [1.0, arg1_snql], alias=alias)


def session_duration_filters(org_id: int) -> list[Function]:
    return [
        Function(
            "equals",
            (
                Column(resolve_tag_key(UseCaseID.SESSIONS, org_id, "session.status")),
                resolve_tag_value(UseCaseID.SESSIONS, org_id, "exited"),
            ),
        )
    ]


def histogram_snql_factory(
    aggregate_filter: Function,
    histogram_from: float | None = None,
    histogram_to: float | None = None,
    histogram_buckets: int = 100,
    alias: str | None = None,
) -> Function:
    zoom_conditions = zoom_histogram(
        histogram_buckets=histogram_buckets,
        histogram_from=histogram_from,
        histogram_to=histogram_to,
    )
    if zoom_conditions is not None:
        conditions = Function("and", [zoom_conditions, aggregate_filter])
    else:
        conditions = aggregate_filter

    return Function(
        f"histogramIf({MAX_HISTOGRAM_BUCKET})",
        [Column("value"), conditions],
        alias=alias,
    )


def rate_snql_factory(
    aggregate_filter: Function,
    numerator: float,
    denominator: float = 1.0,
    alias: str | None = None,
) -> Function:
    return Function(
        "divide",
        [
            Function("countIf", [Column("value"), aggregate_filter]),
            Function("divide", [numerator, denominator]),
        ],
        alias=alias,
    )


def operation_if_column_snql(
    operation: str,
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    if_column: str,
    if_value: str,
    alias: str | None = None,
) -> Function:
    return Function(
        operation,
        [
            Column("value"),
            Function(
                "and",
                [
                    aggregate_filter,
                    Function(
                        "equals",
                        [
                            Column(resolve_tag_key(use_case_id, org_id, if_column)),
                            resolve_tag_value(use_case_id, org_id, if_value),
                        ],
                    ),
                ],
            ),
        ],
        alias=alias,
    )


def timestamp_column_snql(
    operation: str,
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    alias: str | None = None,
) -> Function:
    return Function(
        operation,
        [
            Column("timestamp"),
            aggregate_filter,
        ],
        alias=alias,
    )


def sum_if_column_snql(
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    if_column: str,
    if_value: str,
    alias: str | None = None,
) -> Function:
    return operation_if_column_snql(
        "sumIf", aggregate_filter, org_id, use_case_id, if_column, if_value, alias
    )


def uniq_if_column_snql(
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    if_column: str,
    if_value: str,
    alias: str | None = None,
) -> Function:
    return operation_if_column_snql(
        "uniqIf", aggregate_filter, org_id, use_case_id, if_column, if_value, alias
    )


def min_timestamp(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return timestamp_column_snql("minIf", aggregate_filter, org_id, use_case_id, alias)


def max_timestamp(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return timestamp_column_snql("maxIf", aggregate_filter, org_id, use_case_id, alias)
