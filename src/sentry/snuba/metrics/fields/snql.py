from typing import List

from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.metrics.naming_layer.public import (
    TransactionSatisfactionTagValue,
    TransactionStatusTagValue,
    TransactionTagsKey,
)


def _aggregation_on_session_status_func_factory(aggregate):
    def _snql_on_session_status_factory(org_id, session_status, metric_ids, alias=None):
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
                                Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                                resolve_weak(org_id, session_status),
                            ],
                        ),
                        Function("in", [Column("metric_id"), list(metric_ids)]),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_session_status_factory


def _counter_sum_aggregation_on_session_status_factory(
    org_id: int, session_status, metric_ids, alias=None
):
    return _aggregation_on_session_status_func_factory(aggregate="sumIf")(
        org_id, session_status, metric_ids, alias
    )


def _set_uniq_aggregation_on_session_status_factory(
    org_id: int, session_status, metric_ids, alias=None
):
    return _aggregation_on_session_status_func_factory(aggregate="uniqIf")(
        org_id, session_status, metric_ids, alias
    )


def _aggregation_on_tx_status_func_factory(aggregate):
    def _get_snql_conditions(org_id, metric_ids, exclude_tx_statuses):
        metric_match = Function("in", [Column("metric_id"), list(metric_ids)])
        assert exclude_tx_statuses is not None
        if len(exclude_tx_statuses) == 0:
            return metric_match

        tx_col = Column(
            f"tags[{resolve_weak(org_id, TransactionTagsKey.TRANSACTION_STATUS.value)}]"
        )
        excluded_statuses = [resolve_weak(org_id, s) for s in exclude_tx_statuses]
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

    def _snql_on_tx_status_factory(org_id, exclude_tx_statuses: List[str], metric_ids, alias=None):
        return Function(
            aggregate,
            [Column("value"), _get_snql_conditions(org_id, metric_ids, exclude_tx_statuses)],
            alias,
        )

    return _snql_on_tx_status_factory


def _dist_count_aggregation_on_tx_status_factory(
    org_id, exclude_tx_statuses: List[str], metric_ids, alias=None
):
    return _aggregation_on_tx_status_func_factory("countIf")(
        org_id, exclude_tx_statuses, metric_ids, alias
    )


def _aggregation_on_tx_satisfaction_func_factory(aggregate):
    def _snql_on_tx_satisfaction_factory(org_id, satisfaction_value: str, metric_ids, alias=None):
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
                                    f"tags[{resolve_weak(org_id, TransactionTagsKey.TRANSACTION_SATISFACTION.value)}]"
                                ),
                                resolve_weak(org_id, satisfaction_value),
                            ],
                        ),
                        Function("in", [Column("metric_id"), list(metric_ids)]),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_tx_satisfaction_factory


def _dist_count_aggregation_on_tx_satisfaction_factory(
    org_id, satisfaction: str, metric_ids, alias=None
):
    return _aggregation_on_tx_satisfaction_func_factory("countIf")(
        org_id, satisfaction, metric_ids, alias
    )


def _set_count_aggregation_on_tx_satisfaction_factory(
    org_id, satisfaction: str, metric_ids, alias=None
):
    return _aggregation_on_tx_satisfaction_func_factory("uniqIf")(
        org_id=org_id, satisfaction_value=satisfaction, metric_ids=metric_ids, alias=alias
    )


def all_sessions(org_id: int, metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="init", metric_ids=metric_ids, alias=alias
    )


def all_users(org_id: int, metric_ids, alias=None):
    return uniq_aggregation_on_metric(metric_ids, alias)


def crashed_sessions(org_id: int, metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def crashed_users(org_id: int, metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def errored_preaggr_sessions(org_id: int, metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="errored_preaggr", metric_ids=metric_ids, alias=alias
    )


def abnormal_sessions(org_id: int, metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        org_id, session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def abnormal_users(org_id: int, metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def errored_all_users(org_id: int, metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        org_id, session_status="errored", metric_ids=metric_ids, alias=alias
    )


def uniq_aggregation_on_metric(metric_ids, alias=None):
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


def all_transactions(org_id, metric_ids, alias=None):
    return _dist_count_aggregation_on_tx_status_factory(
        org_id,
        exclude_tx_statuses=[],
        metric_ids=metric_ids,
        alias=alias,
    )


def failure_count_transaction(org_id, metric_ids, alias=None):
    return _dist_count_aggregation_on_tx_status_factory(
        org_id,
        exclude_tx_statuses=[
            # See statuses in https://docs.sentry.io/product/performance/metrics/#failure-rate
            TransactionStatusTagValue.OK.value,
            TransactionStatusTagValue.CANCELLED.value,
            TransactionStatusTagValue.UNKNOWN.value,
        ],
        metric_ids=metric_ids,
        alias=alias,
    )


def satisfaction_count_transaction(org_id, metric_ids, alias=None):
    return _dist_count_aggregation_on_tx_satisfaction_factory(
        org_id, TransactionSatisfactionTagValue.SATISFIED.value, metric_ids, alias
    )


def tolerated_count_transaction(org_id, metric_ids, alias=None):
    return _dist_count_aggregation_on_tx_satisfaction_factory(
        org_id, TransactionSatisfactionTagValue.TOLERATED.value, metric_ids, alias
    )


def apdex(satisfactory_snql, tolerable_snql, total_snql, alias=None):
    return division_float(
        arg1_snql=addition(satisfactory_snql, division_float(tolerable_snql, 2)),
        arg2_snql=total_snql,
        alias=alias,
    )


def miserable_users(org_id, metric_ids, alias=None):
    return _set_count_aggregation_on_tx_satisfaction_factory(
        org_id=org_id,
        satisfaction=TransactionSatisfactionTagValue.FRUSTRATED.value,
        metric_ids=metric_ids,
        alias=alias,
    )


def subtraction(arg1_snql, arg2_snql, alias=None):
    return Function("minus", [arg1_snql, arg2_snql], alias)


def addition(arg1_snql, arg2_snql, alias=None):
    return Function("plus", [arg1_snql, arg2_snql], alias)


def division_float(arg1_snql, arg2_snql, alias=None):
    return Function(
        "divide",
        # Clickhouse can manage divisions by 0, see:
        # https://clickhouse.com/docs/en/sql-reference/functions/arithmetic-functions/#dividea-b-a-b-operator
        [arg1_snql, arg2_snql],
        alias=alias,
    )


def complement(arg1_snql, alias=None):
    """(x) -> (1 - x)"""
    return Function("minus", [1.0, arg1_snql], alias=alias)


def session_duration_filters(org_id):
    return [
        Function(
            "equals",
            (
                Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                resolve_weak(org_id, "exited"),
            ),
        )
    ]
