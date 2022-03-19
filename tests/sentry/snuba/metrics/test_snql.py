from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.metrics import (
    crashed_sessions,
    errored_preaggr_sessions,
    init_sessions,
    percentage,
    sessions_errored_set,
)
from sentry.testutils import TestCase


class DerivedMetricSnQLTestCase(TestCase):
    def setUp(self):
        self.metric_ids = [0, 1, 2]

    def test_counter_sum_aggregation_on_session_status(self):
        for status, func in [
            ("init", init_sessions),
            ("crashed", crashed_sessions),
            ("errored_preaggr", errored_preaggr_sessions),
        ]:
            assert func(self.metric_ids, alias=status) == Function(
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
                                    resolve_weak(status),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_sum_aggregation_for_errored_sessions(self):
        alias = "whatever"
        assert sessions_errored_set(self.metric_ids, alias) == Function(
            "uniqIf",
            [
                Column("value"),
                Function(
                    "in",
                    [
                        Column("metric_id"),
                        list(self.metric_ids),
                    ],
                ),
            ],
            alias,
        )

    def test_percentage_in_snql(self):
        alias = "foo.percentage"
        init_session_snql = init_sessions(self.metric_ids, "init_sessions")
        crashed_session_snql = crashed_sessions(self.metric_ids, "crashed_sessions")

        assert percentage(crashed_session_snql, init_session_snql, alias=alias) == Function(
            "minus", [1, Function("divide", [crashed_session_snql, init_session_snql])], alias
        )
