from snuba_sdk import Column, Function

from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.metrics import (
    TransactionStatusTagValue,
    TransactionTagsKey,
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_transactions,
    all_users,
    crashed_sessions,
    crashed_users,
    errored_all_users,
    errored_preaggr_sessions,
    percentage,
    session_duration_filters,
    sessions_errored_set,
    subtraction,
)
from sentry.snuba.metrics.fields.snql import failure_count_transaction, failure_rate_transaction
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

    def test_dist_count_aggregation_on_tx_status(self):
        org_id = 1985

        expected_all_txs = Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "in",
                    [
                        Column(name="metric_id"),
                        list(self.metric_ids),
                    ],
                    alias=None,
                ),
            ],
            alias="transactions.all",
        )
        assert all_transactions(org_id, self.metric_ids, "transactions.all") == expected_all_txs

        expected_failed_txs = Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "in",
                            [Column(name="metric_id"), list(self.metric_ids)],
                        ),
                        Function(
                            "notIn",
                            [
                                Column(
                                    f"tags[{resolve_weak(org_id, TransactionTagsKey.TRANSACTION_STATUS.value)}]"
                                ),
                                [
                                    resolve_weak(org_id, TransactionStatusTagValue.OK.value),
                                    resolve_weak(org_id, TransactionStatusTagValue.CANCELLED.value),
                                    resolve_weak(org_id, TransactionStatusTagValue.UNKNOWN.value),
                                ],
                            ],
                        ),
                    ],
                ),
            ],
            alias="transactions.failed",
        )
        assert (
            failure_count_transaction(org_id, self.metric_ids, "transactions.failed")
            == expected_failed_txs
        )

        assert failure_rate_transaction(
            failure_count_transaction(org_id, self.metric_ids, "transactions.failed"),
            all_transactions(org_id, self.metric_ids, "transactions.all"),
            alias="transactions.failure_rate",
        ) == Function(
            "divide",
            [
                expected_failed_txs,
                expected_all_txs,
            ],
            alias="transactions.failure_rate",
        )

    def test_percentage_in_snql(self):
        org_id = 666
        alias = "foo.percentage"
        init_session_snql = all_sessions(org_id, self.metric_ids, "init_sessions")
        crashed_session_snql = crashed_sessions(org_id, self.metric_ids, "crashed_sessions")

        assert percentage(crashed_session_snql, init_session_snql, alias=alias) == Function(
            "minus", [1, Function("divide", [crashed_session_snql, init_session_snql])], alias
        )

    def test_addition_in_snql(self):
        org_id = 666
        alias = "session.crashed_and_abnormal_user"
        arg1_snql = crashed_users(org_id, self.metric_ids, alias="session.crashed_user")
        arg2_snql = abnormal_users(org_id, self.metric_ids, alias="session.abnormal_user")
        assert (
            addition(
                arg1_snql,
                arg2_snql,
                alias=alias,
            )
            == Function("plus", [arg1_snql, arg2_snql], alias=alias)
        )

    def test_subtraction_in_snql(self):
        org_id = 666
        arg1_snql = all_users(org_id, self.metric_ids, alias="session.all_user")
        arg2_snql = errored_all_users(org_id, self.metric_ids, alias="session.errored_user_all")

        assert (
            subtraction(
                arg1_snql,
                arg2_snql,
                alias="session.healthy_user",
            )
            == Function("minus", [arg1_snql, arg2_snql], alias="session.healthy_user")
        )

    def test_session_duration_filters(self):
        org_id = 666
        assert session_duration_filters(org_id) == [
            Function(
                "equals",
                (
                    Column(f"tags[{resolve_weak(org_id, 'session.status')}]"),
                    resolve_weak(org_id, "exited"),
                ),
            )
        ]
