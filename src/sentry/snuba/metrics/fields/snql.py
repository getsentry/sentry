from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from snuba_sdk import Column, Function

from sentry.exceptions import InvalidParams
from sentry.search.events import constants
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import (
    resolve_tag_key,
    resolve_tag_value,
)
from sentry.snuba.metrics.fields.histogram import MAX_HISTOGRAM_BUCKET, zoom_histogram
from sentry.snuba.metrics.naming_layer.public import (
    SpanTagsKey,
    TransactionSatisfactionTagValue,
    TransactionTagsKey,
)


def _aggregation_on_session_status_func_factory(aggregate) -> Function:
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


def all_spans(
    metric_ids: Sequence[int],
    alias: str | None = None,
) -> Function:
    return Function(
        "countIf",
        [
            Column("value"),
            Function("in", [Column("metric_id"), list(metric_ids)]),
        ],
        alias,
    )


def http_error_count_span(
    org_id: int, metric_ids: Sequence[int], alias: str | None = None
) -> Function:
    statuses = [
        resolve_tag_value(UseCaseID.SPANS, org_id, status)
        for status in constants.HTTP_SERVER_ERROR_STATUS
    ]
    base_condition = Function(
        "in",
        [
            Column(
                name=resolve_tag_key(
                    UseCaseID.SPANS,
                    org_id,
                    SpanTagsKey.HTTP_STATUS_CODE.value,
                )
            ),
            list(status for status in statuses if status is not None),
        ],
    )

    return Function(
        "countIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    base_condition,
                    Function("in", [Column("metric_id"), list(metric_ids)]),
                ],
            ),
        ],
        alias,
    )


def subtraction(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function("minus", [arg1_snql, arg2_snql], alias)


def addition(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function("plus", [arg1_snql, arg2_snql], alias)


def division_float(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function(
        "divide",
        # Clickhouse can manage divisions by 0, see:
        # https://clickhouse.com/docs/en/sql-reference/functions/arithmetic-functions/#dividea-b-a-b-operator
        [arg1_snql, arg2_snql],
        alias=alias,
    )


def complement(arg1_snql, alias: str | None = None) -> Function:
    """(x) -> (1 - x)"""
    return Function("minus", [1.0, arg1_snql], alias=alias)


def session_duration_filters(org_id) -> Function:
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


def count_web_vitals_snql_factory(
    aggregate_filter: Function, org_id: int, measurement_rating, alias: str | None = None
) -> Function:
    return Function(
        "countIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    aggregate_filter,
                    Function(
                        "equals",
                        (
                            Column(
                                resolve_tag_key(
                                    UseCaseID.TRANSACTIONS, org_id, "measurement_rating"
                                )
                            ),
                            resolve_tag_value(UseCaseID.TRANSACTIONS, org_id, measurement_rating),
                        ),
                    ),
                ],
            ),
        ],
        alias=alias,
    )


def count_transaction_name_snql_factory(
    aggregate_filter: Function, org_id: int, transaction_name, alias: str | None = None
) -> Function:
    is_unparameterized = "is_unparameterized"
    is_null = "is_null"
    has_value = "has_value"

    def generate_transaction_name_filter(operation, transaction_name_identifier) -> Function:
        if transaction_name_identifier == is_unparameterized:
            inner_tag_value = resolve_tag_value(
                UseCaseID.TRANSACTIONS, org_id, "<< unparameterized >>"
            )
        elif transaction_name_identifier == is_null:
            inner_tag_value = ""
        else:
            raise InvalidParams("Invalid condition for tag value filter")

        return Function(
            operation,
            [
                Column(
                    resolve_tag_key(
                        UseCaseID.TRANSACTIONS,
                        org_id,
                        "transaction",
                    )
                ),
                inner_tag_value,
            ],
        )

    if transaction_name in [is_unparameterized, is_null]:
        transaction_name_filter = generate_transaction_name_filter("equals", transaction_name)
    elif transaction_name == has_value:
        transaction_name_filter = Function(
            "and",
            [
                generate_transaction_name_filter("notEquals", is_null),
                generate_transaction_name_filter("notEquals", is_unparameterized),
            ],
        )
    else:
        raise InvalidParams(
            f"The `count_transaction_name` function expects a valid transaction name filter, which must be either "
            f"{is_unparameterized} {is_null} {has_value} but {transaction_name} was passed"
        )

    return Function(
        "countIf",
        [
            Column("value"),
            Function(
                "and",
                [aggregate_filter, transaction_name_filter],
            ),
        ],
        alias=alias,
    )


def team_key_transaction_snql(
    org_id: int, team_key_condition_rhs, alias: str | None = None
) -> Function:
    team_key_conditions = set()
    for elem in team_key_condition_rhs:
        if len(elem) != 2:
            raise InvalidParams("Invalid team_key_condition in params")

        project_id, transaction_name = elem
        team_key_conditions.add(
            (
                project_id,
                resolve_tag_value(UseCaseID.TRANSACTIONS, org_id, transaction_name),
            )
        )

    return Function(
        "in",
        [
            (
                Column("project_id"),
                Column(resolve_tag_key(UseCaseID.TRANSACTIONS, org_id, "transaction")),
            ),
            list(team_key_conditions),
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


def total_count(aggregate_filter: Function, alias: str | None = None) -> Function:
    return Function("sumIf", [Column("value"), aggregate_filter], alias=alias)


def on_demand_failure_rate_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    """Divide the number of transactions that failed from the total."""
    return Function(
        "divide",
        [
            on_demand_failure_count_snql_factory(
                aggregate_filter, org_id, use_case_id, "failure_count"
            ),
            total_count(aggregate_filter),
        ],
        alias=alias,
    )


def on_demand_failure_count_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    """Count the number of transactions where the failure tag is set to true."""
    return Function(
        "sumIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    Function(
                        "equals",
                        [
                            Column(resolve_tag_key(use_case_id, org_id, "failure")),
                            resolve_tag_value(use_case_id, org_id, "true"),
                        ],
                    ),
                    aggregate_filter,
                ],
            ),
        ],
        alias=alias,
    )


def on_demand_apdex_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    # For more information about the formula, check https://docs.sentry.io/product/performance/metrics/#apdex.

    satisfactory = Function(
        "sumIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    Function(
                        "equals",
                        [
                            Column(resolve_tag_key(use_case_id, org_id, "satisfaction")),
                            resolve_tag_value(use_case_id, org_id, "satisfactory"),
                        ],
                    ),
                    aggregate_filter,
                ],
            ),
        ],
    )
    tolerable_divided_by_2 = Function(
        "divide",
        [
            Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(resolve_tag_key(use_case_id, org_id, "satisfaction")),
                                    resolve_tag_value(use_case_id, org_id, "tolerable"),
                                ],
                            ),
                            aggregate_filter,
                        ],
                    ),
                ],
            ),
            2,
        ],
    )

    return Function(
        "divide",
        [Function("plus", [satisfactory, tolerable_divided_by_2]), total_count(aggregate_filter)],
        alias=alias,
    )


def on_demand_count_unique_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return Function("uniq", [Column("value")], alias=alias)


def on_demand_count_web_vitals_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    # This function only queries the tag "measurement_rating: matches_hash" since the extracted metric query hash contains the measurement_rating
    # and extraction only happens for that specific measurement_rating. The query-hash is already specified in the where clause.
    return Function(
        "sumIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    Function(
                        "equals",
                        [
                            Column(resolve_tag_key(use_case_id, org_id, "measurement_rating")),
                            resolve_tag_value(use_case_id, org_id, "matches_hash"),
                        ],
                    ),
                    aggregate_filter,
                ],
            ),
        ],
        alias=alias,
    )


def on_demand_epm_snql_factory(
    aggregate_filter: Function,
    interval: float,
    alias: str | None,
) -> Function:
    return rate_snql_factory(aggregate_filter, interval, 60, alias)


def on_demand_eps_snql_factory(
    aggregate_filter: Function,
    interval: float,
    alias: str | None,
) -> Function:
    return rate_snql_factory(aggregate_filter, interval, 1, alias)


def on_demand_user_misery_snql_factory(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    _miserable_users = uniq_if_column_snql(
        aggregate_filter,
        org_id,
        use_case_id,
        TransactionTagsKey.TRANSACTION_SATISFACTION.value,
        TransactionSatisfactionTagValue.FRUSTRATED.value,
    )

    unique_users = Function("uniqIf", [Column("value"), aggregate_filter])
    # (count_miserable(users, threshold) + 5.8875) / (count_unique(users) + 5.8875 + 111.8625)
    # https://github.com/getsentry/sentry/blob/b29efaef31605e2e2247128de0922e8dca576a22/src/sentry/search/events/datasets/discover.py#L206-L230
    return Function(
        "divide",
        [
            Function("plus", [_miserable_users, constants.MISERY_ALPHA]),
            Function("plus", [unique_users, (constants.MISERY_ALPHA + constants.MISERY_BETA)]),
        ],
        alias=alias,
    )
