"""
This is a copy of snql.py with the following changes which are specific to metrics data model version 2:
- All metric_ids are replaced with metric_mris. This is because in the new metrics data model, we
store the metric_mri in the metrics table instead of the metric_id.
- Removed all references to resolve_tag_key, resolve_tag_value, resolve_tag_values, reverse_resolve_weak

Why is this necessary? Why not just update snql.py?
This is necessary because the functions in snql.py are used to generate snql queries for metrics
with ingrained knowledge of the metrics data model. If we litter snql.py with a bunch of logic which
tests for version of metrics data model, the code will get ugly and hard to maintain. Instead, we
create these new functions which are specific to the metrics data model version 2 and use them where
appropriate. When we move over to the new metrics data model, we can simply remove the old snql.py
in a clean way rather than undoing a bunch of changes.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from snuba_sdk import Column, Function

from sentry.exceptions import InvalidParams
from sentry.search.events import constants
from sentry.search.events.datasets.function_aliases import resolve_project_threshold_config
from sentry.search.events.types import SelectType
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value
from sentry.snuba.metrics.fields.histogram import MAX_HISTOGRAM_BUCKET, zoom_histogram
from sentry.snuba.metrics.fields.snql_base import addition, division_float
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.metrics.naming_layer.public import (
    SpanTagsKey,
    TransactionSatisfactionTagValue,
    TransactionStatusTagValue,
    TransactionTagsKey,
)


def _aggregation_on_session_status_func_factory_v2(aggregate) -> Function:
    def _snql_on_session_status_factory(
        org_id: int, session_status: str, metric_mris: Sequence[str], alias: str | None = None
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
                                Column("tags[session.status]"),
                                session_status,
                            ],
                        ),
                        Function("in", [Column("metric_mri"), list(metric_mris)]),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_session_status_factory


def _aggregation_on_abnormal_mechanism_func_factory_v2(
    org_id: int, abnormal_mechanism: Any, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    if isinstance(abnormal_mechanism, list):
        abnormal_mechanism_condition = Function(
            "in",
            [
                Column("tags[abnormal_mechanism]"),
                [mechanism for mechanism in abnormal_mechanism],
            ],
        )
    else:
        abnormal_mechanism_condition = Function(
            "equals",
            [
                Column("tags[abnormal_mechanism]"),
                abnormal_mechanism,
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
                    Function("in", [Column("metric_mri"), list(metric_mris)]),
                ],
            ),
        ],
        alias,
    )


def _counter_sum_aggregation_on_session_status_factory_v2(
    org_id: int, session_status: str, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _aggregation_on_session_status_func_factory_v2(aggregate="sumIf")(
        org_id, session_status, metric_mris, alias
    )


def _set_uniq_aggregation_on_session_status_factory_v2(
    org_id: int, session_status: str, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _aggregation_on_session_status_func_factory_v2(aggregate="uniqIf")(
        org_id, session_status, metric_mris, alias
    )


def _aggregation_on_tx_status_func_factory_v2(aggregate: Function) -> Function:
    def _get_snql_conditions(
        org_id: int, metric_mris: Sequence[str], exclude_tx_statuses: list[str]
    ) -> Function:
        metric_match = Function("in", [Column("metric_mri"), list(metric_mris)])
        assert exclude_tx_statuses is not None
        if len(exclude_tx_statuses) == 0:
            return metric_match

        tx_col = Column(f"tags[{TransactionTagsKey.TRANSACTION_STATUS.value}]")
        excluded_statuses = exclude_tx_statuses
        exclude_tx_statuses = Function(
            "notIn",
            [
                tx_col,
                excluded_statuses,
            ],
        )

        return Function(
            "and",
            [
                metric_match,
                exclude_tx_statuses,
            ],
        )

    def _snql_on_tx_status_factory(
        org_id: int,
        exclude_tx_statuses: list[str],
        metric_mris: Sequence[str],
        alias: str | None = None,
    ) -> Function:
        return Function(
            aggregate,
            [
                Column("value"),
                _get_snql_conditions(org_id, metric_mris, exclude_tx_statuses),
            ],
            alias,
        )

    return _snql_on_tx_status_factory


def _dist_count_aggregation_on_tx_status_factory_v2(
    org_id: int,
    exclude_tx_statuses: list[str],
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return _aggregation_on_tx_status_func_factory_v2("countIf")(
        org_id, exclude_tx_statuses, metric_mris, alias
    )


def _aggregation_on_tx_satisfaction_func_factory_v2(aggregate: Function) -> Function:
    def _snql_on_tx_satisfaction_factory(
        org_id: int, satisfaction_value: str, metric_mris: Sequence[str], alias: str | None = None
    ) -> Function:
        return Function(
            aggregate,
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function("in", [Column("metric_mri"), list(metric_mris)]),
                        Function(
                            "equals",
                            [
                                Column(
                                    f"tags[{TransactionTagsKey.TRANSACTION_SATISFACTION.value}]",
                                ),
                                satisfaction_value,
                            ],
                        ),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_tx_satisfaction_factory


def _dist_count_aggregation_on_tx_satisfaction_factory_v2(
    org_id: int, satisfaction: str, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _aggregation_on_tx_satisfaction_func_factory_v2("countIf")(
        org_id, satisfaction, metric_mris, alias
    )


def _set_count_aggregation_on_tx_satisfaction_factory_v2(
    org_id: int, satisfaction: str, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _aggregation_on_tx_satisfaction_func_factory_v2("uniqIf")(
        org_id=org_id,
        satisfaction_value=satisfaction,
        metric_mris=metric_mris,
        alias=alias,
    )


def all_sessions_v2(org_id: int, metric_mris: Sequence[str], alias: str | None = None) -> Function:
    return _counter_sum_aggregation_on_session_status_factory_v2(
        org_id, session_status="init", metric_mris=metric_mris, alias=alias
    )


def all_users_v2(org_id: int, metric_mris: Sequence[str], alias: str | None = None) -> Function:
    return uniq_aggregation_on_metric_v2(metric_mris, alias)


def crashed_sessions_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _counter_sum_aggregation_on_session_status_factory_v2(
        org_id, session_status="crashed", metric_mris=metric_mris, alias=alias
    )


def crashed_users_v2(org_id: int, metric_mris: Sequence[str], alias: str | None = None) -> Function:
    return _set_uniq_aggregation_on_session_status_factory_v2(
        org_id, session_status="crashed", metric_mris=metric_mris, alias=alias
    )


def anr_users_v2(org_id: int, metric_mris: Sequence[str], alias: str | None = None) -> Function:
    return _aggregation_on_abnormal_mechanism_func_factory_v2(
        org_id,
        abnormal_mechanism=["anr_foreground", "anr_background"],
        metric_mris=metric_mris,
        alias=alias,
    )


def foreground_anr_users_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _aggregation_on_abnormal_mechanism_func_factory_v2(
        org_id,
        abnormal_mechanism="anr_foreground",
        metric_mris=metric_mris,
        alias=alias,
    )


def errored_preaggr_sessions_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _counter_sum_aggregation_on_session_status_factory_v2(
        org_id, session_status="errored_preaggr", metric_mris=metric_mris, alias=alias
    )


def abnormal_sessions_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _counter_sum_aggregation_on_session_status_factory_v2(
        org_id, session_status="abnormal", metric_mris=metric_mris, alias=alias
    )


def abnormal_users_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _set_uniq_aggregation_on_session_status_factory_v2(
        org_id, session_status="abnormal", metric_mris=metric_mris, alias=alias
    )


def errored_all_users_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _set_uniq_aggregation_on_session_status_factory_v2(
        org_id, session_status="errored", metric_mris=metric_mris, alias=alias
    )


def uniq_aggregation_on_metric_v2(metric_mris: Sequence[str], alias: str | None = None) -> Function:
    return Function(
        "uniqIf",
        [
            Column("value"),
            Function(
                "in",
                [
                    Column("metric_mri"),
                    list(metric_mris),
                ],
            ),
        ],
        alias,
    )


def failure_count_transaction_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _dist_count_aggregation_on_tx_status_factory_v2(
        org_id,
        exclude_tx_statuses=[
            # See statuses in https://docs.sentry.io/product/performance/metrics/#failure-rate
            TransactionStatusTagValue.OK.value,
            TransactionStatusTagValue.CANCELLED.value,
            TransactionStatusTagValue.UNKNOWN.value,
        ],
        metric_mris=metric_mris,
        alias=alias,
    )


def http_error_count_transaction_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    statuses = [status for status in constants.HTTP_SERVER_ERROR_STATUS]
    base_condition = Function(
        "in",
        [
            Column(
                f"tags[{TransactionTagsKey.TRANSACTION_HTTP_STATUS_CODE.value}]",
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
                    Function("in", [Column("metric_mri"), list(metric_mris)]),
                ],
            ),
        ],
        alias,
    )


def all_spans_v2(
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return Function(
        "countIf",
        [
            Column("value"),
            Function("in", [Column("metric_mri"), list(metric_mris)]),
        ],
        alias,
    )


def http_error_count_span_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    statuses = [status for status in constants.HTTP_SERVER_ERROR_STATUS]
    base_condition = Function(
        "in",
        [
            Column(
                f"tags[{SpanTagsKey.HTTP_STATUS_CODE.value}]",
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
                    Function("in", [Column("metric_mri"), list(metric_mris)]),
                ],
            ),
        ],
        alias,
    )


def _project_threshold_multi_if_function_v2(
    project_ids: Sequence[int], org_id: int, metric_mris: Sequence[str]
) -> Function:
    return Function(
        "multiIf",
        [
            Function(
                "equals",
                [
                    _resolve_project_threshold_config_v2(
                        project_ids,
                        org_id,
                    ),
                    "lcp",
                ],
            ),
            TransactionMRI.MEASUREMENTS_LCP.value,
            TransactionMRI.DURATION.value,
        ],
    )


def _satisfaction_equivalence_v2(org_id: int, satisfaction_tag_value: str) -> Function:
    return Function(
        "equals",
        [
            Column(
                f"tags[{TransactionTagsKey.TRANSACTION_SATISFACTION.value}]",
            ),
            satisfaction_tag_value,
        ],
    )


def _metric_mri_equivalence_v2(metric_condition: Function | int) -> Function:
    return Function(
        "equals",
        [
            Column("metric_mri"),
            metric_condition,
        ],
    )


def _count_if_with_conditions_v2(
    conditions: Sequence[Function],
    alias: str | None = None,
) -> Function:
    def _generate_conditions(inner_conditions: Sequence[Function]) -> Function:
        return (
            Function(
                "and",
                conditions,
            )
            if len(inner_conditions) > 1
            else inner_conditions[0]
        )

    return Function(
        "countIf",
        [
            Column("value"),
            _generate_conditions(conditions),
        ],
        alias,
    )


def satisfaction_count_transaction_v2(
    project_ids: Sequence[int],
    org_id: int,
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return _count_if_with_conditions_v2(
        [
            _metric_mri_equivalence_v2(
                _project_threshold_multi_if_function_v2(project_ids, org_id, metric_mris)
            ),
            _satisfaction_equivalence_v2(org_id, TransactionSatisfactionTagValue.SATISFIED.value),
        ],
        alias,
    )


def tolerated_count_transaction_v2(
    project_ids: Sequence[int],
    org_id: int,
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return _count_if_with_conditions_v2(
        [
            _metric_mri_equivalence_v2(
                _project_threshold_multi_if_function_v2(project_ids, org_id, metric_mris)
            ),
            _satisfaction_equivalence_v2(org_id, TransactionSatisfactionTagValue.TOLERATED.value),
        ],
        alias,
    )


def all_transactions_v2(
    project_ids: Sequence[int],
    org_id: int,
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return _count_if_with_conditions_v2(
        [
            _metric_mri_equivalence_v2(
                _project_threshold_multi_if_function_v2(project_ids, org_id, metric_mris)
            ),
        ],
        alias,
    )


def all_duration_transactions_v2(
    metric_mris: Sequence[str],
    alias: str | None = None,
) -> Function:
    return _count_if_with_conditions_v2(
        [
            _metric_mri_equivalence_v2(list(metric_mris)[0]),
        ],
        alias,
    )


def apdex_v2(satisfactory_snql, tolerable_snql, total_snql, alias: str | None = None) -> Function:
    return division_float(
        arg1_snql=addition(satisfactory_snql, division_float(tolerable_snql, 2)),
        arg2_snql=total_snql,
        alias=alias,
    )


def miserable_users_v2(
    org_id: int, metric_mris: Sequence[str], alias: str | None = None
) -> Function:
    return _set_count_aggregation_on_tx_satisfaction_factory_v2(
        org_id=org_id,
        satisfaction=TransactionSatisfactionTagValue.FRUSTRATED.value,
        metric_mris=metric_mris,
        alias=alias,
    )


def session_duration_filters_v2(org_id) -> Function:
    return [
        Function(
            "equals",
            (
                Column("tags[session.status]"),
                "exited",
            ),
        )
    ]


def histogram_snql_factory_v2(
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


def rate_snql_factory_v2(
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


def count_web_vitals_snql_factory_v2(
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
                            Column("tags[measurement_rating]"),
                            measurement_rating,
                        ),
                    ),
                ],
            ),
        ],
        alias=alias,
    )


def count_transaction_name_snql_factory_v2(
    aggregate_filter: Function, org_id: int, transaction_name, alias: str | None = None
) -> Function:
    is_unparameterized = "is_unparameterized"
    is_null = "is_null"
    has_value = "has_value"

    def generate_transaction_name_filter(operation, transaction_name_identifier) -> Function:
        if transaction_name_identifier == is_unparameterized:
            inner_tag_value = "<< unparameterized >>"
        elif transaction_name_identifier == is_null:
            inner_tag_value = ""
        else:
            raise InvalidParams("Invalid condition for tag value filter")

        return Function(
            operation,
            [
                Column(
                    "tags[transaction]",
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


def team_key_transaction_snql_v2(
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
                transaction_name,
            )
        )

    return Function(
        "in",
        [
            (
                Column("project_id"),
                Column("transaction"),
            ),
            list(team_key_conditions),
        ],
        alias=alias,
    )


def _resolve_project_threshold_config_v2(project_ids: Sequence[int], org_id: int) -> SelectType:
    # TODO(nikhar): Look into how to solve this funtion
    return resolve_project_threshold_config(
        tag_value_resolver=lambda use_case_id, org_id, value: resolve_tag_value(
            use_case_id, org_id, value
        ),
        column_name_resolver=lambda use_case_id, org_id, value: resolve_tag_key(
            use_case_id, org_id, value
        ),
        project_ids=project_ids,
        org_id=org_id,
        use_case_id=UseCaseID.TRANSACTIONS,
    )


def operation_if_column_snql_v2(
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
                            Column(f"tags[{if_column}]"),
                            if_value,
                        ],
                    ),
                ],
            ),
        ],
        alias=alias,
    )


def timestamp_column_snql_v2(
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


def sum_if_column_snql_v2(
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    if_column: str,
    if_value: str,
    alias: str | None = None,
) -> Function:
    return operation_if_column_snql_v2(
        "sumIf", aggregate_filter, org_id, use_case_id, if_column, if_value, alias
    )


def uniq_if_column_snql_v2(
    aggregate_filter: Function,
    org_id: int,
    use_case_id: UseCaseID,
    if_column: str,
    if_value: str,
    alias: str | None = None,
) -> Function:
    return operation_if_column_snql_v2(
        "uniqIf", aggregate_filter, org_id, use_case_id, if_column, if_value, alias
    )


def min_timestamp_v2(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return timestamp_column_snql_v2("minIf", aggregate_filter, org_id, use_case_id, alias)


def max_timestamp_v2(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return timestamp_column_snql_v2("maxIf", aggregate_filter, org_id, use_case_id, alias)


def total_count_v2(aggregate_filter: Function, alias: str | None = None) -> Function:
    return Function("sumIf", [Column("value"), aggregate_filter], alias=alias)


def on_demand_failure_rate_snql_factory_v2(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    """Divide the number of transactions that failed from the total."""
    return Function(
        "divide",
        [
            on_demand_failure_count_snql_factory_v2(
                aggregate_filter, org_id, use_case_id, "failure_count"
            ),
            total_count_v2(aggregate_filter),
        ],
        alias=alias,
    )


def on_demand_failure_count_snql_factory_v2(
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
                            Column("tags[failure]"),
                            "true",
                        ],
                    ),
                    aggregate_filter,
                ],
            ),
        ],
        alias=alias,
    )


def on_demand_apdex_snql_factory_v2(
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
                            Column("tags[satisfaction]"),
                            "satisfactory",
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
                                    Column("tags[satisfaction]"),
                                    "tolerable",
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
        [
            Function("plus", [satisfactory, tolerable_divided_by_2]),
            total_count_v2(aggregate_filter),
        ],
        alias=alias,
    )


def on_demand_count_unique_snql_factory_v2(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    return Function("uniq", [Column("value")], alias=alias)


def on_demand_count_web_vitals_snql_factory_v2(
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
                            Column("tags[measurement_rating]"),
                            "matches_hash",
                        ],
                    ),
                    aggregate_filter,
                ],
            ),
        ],
        alias=alias,
    )


def on_demand_epm_snql_factory_v2(
    aggregate_filter: Function,
    interval: float,
    alias: str | None,
) -> Function:
    return rate_snql_factory_v2(aggregate_filter, interval, 60, alias)


def on_demand_eps_snql_factory_v2(
    aggregate_filter: Function,
    interval: float,
    alias: str | None,
) -> Function:
    return rate_snql_factory_v2(aggregate_filter, interval, 1, alias)


def on_demand_user_misery_snql_factory_v2(
    aggregate_filter: Function, org_id: int, use_case_id: UseCaseID, alias: str | None = None
) -> Function:
    _miserable_users = uniq_if_column_snql_v2(
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


def transform_null_transaction_to_unparameterized_v2(use_case_id, org_id, alias=None):
    """
    This function transforms any null tag.transaction to '<< unparameterized >>' so that it can be handled
    as such in any query using that tag value.

    The logic behind this query is that ClickHouse will return '' in case tag.transaction is not set and we want to
    transform that '' as '<< unparameterized >>'.

    It is important to note that this transformation has to be applied ONLY on tag.transaction.
    """
    return Function(
        function="transform",
        parameters=[
            Column("tags[transaction]"),
            [""],
            ["<< unparameterized >>"],
        ],
        alias=alias,
    )
