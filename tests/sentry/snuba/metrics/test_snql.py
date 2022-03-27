from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.metrics import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_users,
    crashed_sessions,
    crashed_users,
    errored_all_users,
    errored_preaggr_sessions,
    percentage,
    sessions_errored_set,
    subtraction,
)
from sentry.testutils import TestCase


class DerivedMetricSnQLTestCase(TestCase):
    def setUp(self):
        self.metric_ids = [0, 1, 2]

    def test_counter_sum_aggregation_on_session_status(self):
        org_id = 0
        for status, func in [
            ("init", all_sessions),
            ("crashed", crashed_sessions),
            ("errored_preaggr", errored_preaggr_sessions),
            ("abnormal", abnormal_sessions),
        ]:
            assert func(org_id, self.metric_ids, alias=status) == Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                                    resolve_weak(org_id, status),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_uniq_aggregation_on_session_status(self):
        for status, func in [
            ("init", all_users),
            ("crashed", crashed_users),
            ("abnormal", abnormal_users),
            ("errored", errored_all_users),
        ]:
            org_id = 666
            assert func(org_id, self.metric_ids, alias=status) == Function(
                "uniqIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                                    resolve_weak(org_id, status),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_sum_aggregation_for_errored_sessions(self):
        org_id = 666
        alias = "whatever"
        assert sessions_errored_set(org_id, self.metric_ids, alias) == Function(
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
        org_id = 666
        alias = "foo.percentage"
        init_session_snql = all_sessions(org_id, self.metric_ids, "init_sessions")
        crashed_session_snql = crashed_sessions(org_id, self.metric_ids, "crashed_sessions")

        assert percentage(org_id, crashed_session_snql, init_session_snql, alias=alias) == Function(
            "minus", [1, Function("divide", [crashed_session_snql, init_session_snql])], alias
        )

    def test_addition_in_snql(self):
        alias = "session.crashed_and_abnormal_user"
        arg1_snql = crashed_users(self.metric_ids, alias="session.crashed_user")
        arg2_snql = abnormal_users(self.metric_ids, alias="session.abnormal_user")
        assert (
            addition(
                arg1_snql,
                arg2_snql,
                alias=alias,
            )
            == Function("plus", [arg1_snql, arg2_snql], alias=alias)
        )

    def test_subtraction_in_snql(self):
        arg1_snql = all_users(self.metric_ids, alias="session.all_user")
        arg2_snql = errored_all_users(self.metric_ids, alias="session.errored_user_all")

        assert (
            subtraction(
                arg1_snql,
                arg2_snql,
                alias="session.healthy_user",
            )
            == Function("minus", [arg1_snql, arg2_snql], alias="session.healthy_user")
        )
