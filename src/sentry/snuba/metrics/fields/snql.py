from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak


def _counter_sum_aggregation_on_session_status_factory(session_status, metric_ids, alias=None):
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


def init_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="init", metric_ids=metric_ids, alias=alias
    )


def crashed_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="crashed", metric_ids=metric_ids, alias=alias
    )


def errored_preaggr_sessions(metric_ids, alias=None):
    return _counter_sum_aggregation_on_session_status_factory(
        session_status="errored_preaggr", metric_ids=metric_ids, alias=alias
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
