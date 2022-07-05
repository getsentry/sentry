from snuba_sdk import Column, Function

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
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
    session_duration_filters,
    subtraction,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.fields.snql import (
    complement,
    division_float,
    failure_count_transaction,
    miserable_users,
    satisfaction_count_transaction,
    tolerated_count_transaction,
)
from sentry.snuba.metrics.naming_layer.public import TransactionSatisfactionTagValue
from sentry.testutils import TestCase


class DerivedMetricSnQLTestCase(TestCase):
    def setUp(self):
        self.org_id = 666
        self.metric_ids = [0, 1, 2]
        indexer.bulk_record(
            use_case_id=UseCaseKey.RELEASE_HEALTH,
            org_strings={
                self.org_id: [
                    "abnormal",
                    "crashed",
                    "errored_preaggr",
                    "errored",
                    "exited",
                    "init",
                    "session.status",
                    TransactionSatisfactionTagValue.FRUSTRATED.value,
                    TransactionSatisfactionTagValue.SATISFIED.value,
                    TransactionSatisfactionTagValue.TOLERATED.value,
                    TransactionStatusTagValue.CANCELLED.value,
                    TransactionStatusTagValue.OK.value,
                    TransactionStatusTagValue.UNKNOWN.value,
                    TransactionTagsKey.TRANSACTION_SATISFACTION.value,
                    TransactionTagsKey.TRANSACTION_STATUS.value,
                ]
            },
        )

    def test_counter_sum_aggregation_on_session_status(self):
        for status, func in [
            ("init", all_sessions),
            ("crashed", crashed_sessions),
            ("errored_preaggr", errored_preaggr_sessions),
            ("abnormal", abnormal_sessions),
        ]:
            assert func(self.org_id, self.metric_ids, alias=status) == Function(
                "sumIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(
                                        f"tags[{indexer.resolve(self.org_id, 'session.status', use_case_id=UseCaseKey.RELEASE_HEALTH)}]"
                                    ),
                                    indexer.resolve(
                                        self.org_id, status, use_case_id=UseCaseKey.RELEASE_HEALTH
                                    ),
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
            ("crashed", crashed_users),
            ("abnormal", abnormal_users),
            ("errored", errored_all_users),
        ]:

            assert func(self.org_id, self.metric_ids, alias=status) == Function(
                "uniqIf",
                [
                    Column("value"),
                    Function(
                        "and",
                        [
                            Function(
                                "equals",
                                [
                                    Column(
                                        f"tags[{indexer.resolve(self.org_id, 'session.status', use_case_id=UseCaseKey.RELEASE_HEALTH)}]"
                                    ),
                                    indexer.resolve(
                                        self.org_id, status, use_case_id=UseCaseKey.RELEASE_HEALTH
                                    ),
                                ],
                            ),
                            Function("in", [Column("metric_id"), list(self.metric_ids)]),
                        ],
                    ),
                ],
                status,
            )

    def test_set_uniq_aggregation_all_users(self):
        assert all_users(self.org_id, self.metric_ids, alias="foo") == Function(
            "uniqIf",
            [
                Column("value"),
                Function("in", [Column("metric_id"), list(self.metric_ids)]),
            ],
            alias="foo",
        )

    def test_set_sum_aggregation_for_errored_sessions(self):
        alias = "whatever"
        assert uniq_aggregation_on_metric(self.metric_ids, alias) == Function(
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
        assert (
            all_transactions(self.org_id, self.metric_ids, "transactions.all") == expected_all_txs
        )

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
                                    f"tags[{indexer.resolve(self.org_id, TransactionTagsKey.TRANSACTION_STATUS.value, use_case_id=UseCaseKey.RELEASE_HEALTH)}]"
                                ),
                                [
                                    indexer.resolve(
                                        self.org_id,
                                        TransactionStatusTagValue.OK.value,
                                        use_case_id=UseCaseKey.RELEASE_HEALTH,
                                    ),
                                    indexer.resolve(
                                        self.org_id,
                                        TransactionStatusTagValue.CANCELLED.value,
                                        use_case_id=UseCaseKey.RELEASE_HEALTH,
                                    ),
                                    indexer.resolve(
                                        self.org_id,
                                        TransactionStatusTagValue.UNKNOWN.value,
                                        use_case_id=UseCaseKey.RELEASE_HEALTH,
                                    ),
                                ],
                            ],
                        ),
                    ],
                ),
            ],
            alias="transactions.failed",
        )
        assert (
            failure_count_transaction(self.org_id, self.metric_ids, alias="transactions.failed")
            == expected_failed_txs
        )

    def test_set_count_aggregation_on_tx_satisfaction(self):
        alias = "transaction.miserable_user"

        assert miserable_users(self.org_id, self.metric_ids, alias) == Function(
            "uniqIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column(
                                    f"tags[{indexer.resolve(self.org_id, TransactionTagsKey.TRANSACTION_SATISFACTION.value, use_case_id=UseCaseKey.PERFORMANCE)}]"
                                ),
                                indexer.resolve(
                                    self.org_id,
                                    TransactionSatisfactionTagValue.FRUSTRATED.value,
                                    use_case_id=UseCaseKey.RELEASE_HEALTH,
                                ),
                            ],
                        ),
                        Function(
                            "in",
                            [
                                Column("metric_id"),
                                list(self.metric_ids),
                            ],
                        ),
                    ],
                ),
            ],
            alias,
        )

    def test_dist_count_aggregation_on_tx_satisfaction(self):

        assert satisfaction_count_transaction(
            self.org_id, self.metric_ids, "transaction.satisfied"
        ) == Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column(
                                    f"tags[{indexer.resolve(self.org_id, TransactionTagsKey.TRANSACTION_SATISFACTION.value, use_case_id=UseCaseKey.PERFORMANCE)}]"
                                ),
                                indexer.resolve(
                                    self.org_id,
                                    TransactionSatisfactionTagValue.SATISFIED.value,
                                    use_case_id=UseCaseKey.PERFORMANCE,
                                ),
                            ],
                        ),
                        Function(
                            "in",
                            [
                                Column("metric_id"),
                                list(self.metric_ids),
                            ],
                        ),
                    ],
                ),
            ],
            "transaction.satisfied",
        )

        assert tolerated_count_transaction(
            self.org_id, self.metric_ids, alias="transaction.tolerated"
        ) == Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [
                                Column(
                                    f"tags[{indexer.resolve(self.org_id, TransactionTagsKey.TRANSACTION_SATISFACTION.value, use_case_id=UseCaseKey.PERFORMANCE)}]"
                                ),
                                indexer.resolve(
                                    self.org_id,
                                    TransactionSatisfactionTagValue.TOLERATED.value,
                                    use_case_id=UseCaseKey.PERFORMANCE,
                                ),
                            ],
                        ),
                        Function(
                            "in",
                            [
                                Column("metric_id"),
                                list(self.metric_ids),
                            ],
                        ),
                    ],
                ),
            ],
            alias="transaction.tolerated",
        )

    def test_complement_in_sql(self):
        alias = "foo.complement"
        assert complement(0.64, alias=alias) == Function("minus", [1, 0.64], alias)

    def test_addition_in_snql(self):
        alias = "session.crashed_and_abnormal_user"
        arg1_snql = crashed_users(self.org_id, self.metric_ids, alias="session.crashed_user")
        arg2_snql = abnormal_users(self.org_id, self.metric_ids, alias="session.abnormal_user")
        assert addition(
            arg1_snql,
            arg2_snql,
            alias=alias,
        ) == Function("plus", [arg1_snql, arg2_snql], alias=alias)

    def test_subtraction_in_snql(self):
        arg1_snql = all_users(self.org_id, self.metric_ids, alias="session.all_user")
        arg2_snql = errored_all_users(
            self.org_id, self.metric_ids, alias="session.errored_user_all"
        )

        assert subtraction(
            arg1_snql,
            arg2_snql,
            alias="session.healthy_user",
        ) == Function("minus", [arg1_snql, arg2_snql], alias="session.healthy_user")

    def test_division_in_snql(self):
        alias = "transactions.failure_rate"
        failed = failure_count_transaction(self.org_id, self.metric_ids, "transactions.failed")
        all = all_transactions(self.org_id, self.metric_ids, "transactions.all")

        assert division_float(failed, all, alias=alias) == Function(
            "divide",
            [failed, all],
            alias=alias,
        )

    def test_session_duration_filters(self):
        assert session_duration_filters(self.org_id) == [
            Function(
                "equals",
                (
                    Column(
                        f"tags[{indexer.resolve(self.org_id, 'session.status', use_case_id=UseCaseKey.RELEASE_HEALTH)}]"
                    ),
                    indexer.resolve(self.org_id, "exited", use_case_id=UseCaseKey.RELEASE_HEALTH),
                ),
            )
        ]
