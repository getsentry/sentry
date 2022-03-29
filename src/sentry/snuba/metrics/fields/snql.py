from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak


def _aggregation_on_session_status_func_factory(aggregate):
    def _snql_on_session_status_factory(session_status, metric_ids, alias=None):
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
                                Column(f"tags[{resolve_weak('session.status')}]"),
                                resolve_weak(session_status),
                            ],
                        ),
                        Function("in", [Column("metric_id"), list(metric_ids)]),
                    ],
                ),
            ],
            alias,
        )

    return _snql_on_session_status_factory


def _counter_sum_aggregation_on_session_status_factory(session_status, metric_ids, alias=None):
    return _aggregation_on_session_status_func_factory(aggregate="sumIf")(
        session_status, metric_ids, alias
    )


def _set_uniq_aggregation_on_session_status_factory(session_status, metric_ids, alias=None):
    return _aggregation_on_session_status_func_factory(aggregate="uniqIf")(
        session_status, metric_ids, alias
    )


def all_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="init", metric_ids=metric_ids, alias=alias
    )


def all_users(metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        session_status="init", metric_ids=metric_ids, alias=alias
    )


def crashed_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def crashed_users(metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def errored_preaggr_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="errored_preaggr", metric_ids=metric_ids, alias=alias
    )


def abnormal_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def abnormal_users(metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        session_status="abnormal", metric_ids=metric_ids, alias=alias
    )


def errored_all_users(metric_ids, alias=None):
    return _set_uniq_aggregation_on_session_status_factory(
        session_status="errored", metric_ids=metric_ids, alias=alias
    )


def sessions_errored_set(metric_ids, alias=None):
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


def percentage(arg1_snql, arg2_snql, alias=None):
    return Function("minus", [1, Function("divide", [arg1_snql, arg2_snql])], alias)


def subtraction(arg1_snql, arg2_snql, alias=None):
    return Function("minus", [arg1_snql, arg2_snql], alias)


def addition(arg1_snql, arg2_snql, alias=None):
    return Function("plus", [arg1_snql, arg2_snql], alias)
