from unittest.mock import patch

import pytest
from snuba_sdk import Column, Function

from sentry.models.transaction_threshold import (
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
    get_project_threshold_cache_key,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_key, resolve_tag_value, resolve_weak
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_transactions,
    all_users,
    complement,
    count_web_vitals_snql_factory,
    crashed_sessions,
    crashed_users,
    division_float,
    errored_all_users,
    errored_preaggr_sessions,
    failure_count_transaction,
    miserable_users,
    rate_snql_factory,
    satisfaction_count_transaction,
    session_duration_filters,
    subtraction,
    tolerated_count_transaction,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.metrics.naming_layer.public import (
    TransactionSatisfactionTagValue,
    TransactionStatusTagValue,
    TransactionTagsKey,
)
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache

pytestmark = pytest.mark.sentry_metrics


class DerivedMetricSnQLTestCase(TestCase):
    def setUp(self):
        self.org_id = 666
        self.metric_ids = []
        for metric_name in [
            TransactionMRI.MEASUREMENTS_LCP.value,
            TransactionMRI.DURATION.value,
        ]:
            metric_id = indexer.record(UseCaseID.TRANSACTIONS, self.org_id, metric_name)
            assert metric_id is not None
            self.metric_ids.append(metric_id)

        indexer.bulk_record(
            {
                UseCaseID.SESSIONS: {
                    self.org_id: {
                        "abnormal",
                        "crashed",
                        "errored_preaggr",
                        "errored",
                        "exited",
                        "init",
                        "session.status",
                    }
                }
            }
        )
        indexer.bulk_record(
            {
                UseCaseID.TRANSACTIONS: {
                    self.org_id: {
                        TransactionSatisfactionTagValue.FRUSTRATED.value,
                        TransactionSatisfactionTagValue.SATISFIED.value,
                        TransactionSatisfactionTagValue.TOLERATED.value,
                        TransactionStatusTagValue.CANCELLED.value,
                        TransactionStatusTagValue.OK.value,
                        TransactionStatusTagValue.UNKNOWN.value,
                        TransactionTagsKey.TRANSACTION_SATISFACTION.value,
                        TransactionTagsKey.TRANSACTION_STATUS.value,
                    }
                }
            }
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
                                        resolve_tag_key(
                                            UseCaseID.SESSIONS, self.org_id, "session.status"
                                        ),
                                    ),
                                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, status),
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
                                        resolve_tag_key(
                                            UseCaseID.SESSIONS, self.org_id, "session.status"
                                        )
                                    ),
                                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, status),
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
                    "equals",
                    [
                        Column("metric_id"),
                        Function(
                            "multiIf",
                            [
                                Function(
                                    "equals",
                                    [
                                        Function(
                                            function="toString",
                                            parameters=["duration"],
                                        ),
                                        "lcp",
                                    ],
                                ),
                                resolve_weak(
                                    UseCaseID.TRANSACTIONS,
                                    self.org_id,
                                    TransactionMRI.MEASUREMENTS_LCP.value,
                                ),
                                resolve_weak(
                                    UseCaseID.TRANSACTIONS,
                                    self.org_id,
                                    TransactionMRI.DURATION.value,
                                ),
                            ],
                        ),
                    ],
                ),
            ],
            "transactions.all",
        )
        assert (
            all_transactions([self.project.id], self.org_id, self.metric_ids, "transactions.all")
            == expected_all_txs
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
                                    resolve_tag_key(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionTagsKey.TRANSACTION_STATUS.value,
                                    )
                                ),
                                [
                                    resolve_tag_value(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionStatusTagValue.OK.value,
                                    ),
                                    resolve_tag_value(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionStatusTagValue.CANCELLED.value,
                                    ),
                                    resolve_tag_value(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionStatusTagValue.UNKNOWN.value,
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
                                    resolve_tag_key(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionTagsKey.TRANSACTION_SATISFACTION.value,
                                    )
                                ),
                                resolve_tag_value(
                                    UseCaseID.TRANSACTIONS,
                                    self.org_id,
                                    TransactionSatisfactionTagValue.FRUSTRATED.value,
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
            [self.project.id], self.org_id, self.metric_ids, "transaction.satisfied"
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
                                Column("metric_id"),
                                Function(
                                    "multiIf",
                                    [
                                        Function(
                                            "equals",
                                            [
                                                Function(
                                                    function="toString",
                                                    parameters=["duration"],
                                                ),
                                                "lcp",
                                            ],
                                        ),
                                        resolve_weak(
                                            UseCaseID.TRANSACTIONS,
                                            self.org_id,
                                            TransactionMRI.MEASUREMENTS_LCP.value,
                                        ),
                                        resolve_weak(
                                            UseCaseID.TRANSACTIONS,
                                            self.org_id,
                                            TransactionMRI.DURATION.value,
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        Function(
                            "equals",
                            [
                                Column(
                                    name=resolve_tag_key(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionTagsKey.TRANSACTION_SATISFACTION.value,
                                    )
                                ),
                                resolve_tag_value(
                                    UseCaseID.TRANSACTIONS,
                                    self.org_id,
                                    TransactionSatisfactionTagValue.SATISFIED.value,
                                ),
                            ],
                        ),
                    ],
                ),
            ],
            "transaction.satisfied",
        )

        assert tolerated_count_transaction(
            [self.project.id], self.org_id, self.metric_ids, "transaction.tolerated"
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
                                Column("metric_id"),
                                Function(
                                    "multiIf",
                                    [
                                        Function(
                                            "equals",
                                            [
                                                Function(
                                                    function="toString",
                                                    parameters=["duration"],
                                                ),
                                                "lcp",
                                            ],
                                        ),
                                        resolve_weak(
                                            UseCaseID.TRANSACTIONS,
                                            self.org_id,
                                            TransactionMRI.MEASUREMENTS_LCP.value,
                                        ),
                                        resolve_weak(
                                            UseCaseID.TRANSACTIONS,
                                            self.org_id,
                                            TransactionMRI.DURATION.value,
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        Function(
                            "equals",
                            [
                                Column(
                                    name=resolve_tag_key(
                                        UseCaseID.TRANSACTIONS,
                                        self.org_id,
                                        TransactionTagsKey.TRANSACTION_SATISFACTION.value,
                                    )
                                ),
                                resolve_tag_value(
                                    UseCaseID.TRANSACTIONS,
                                    self.org_id,
                                    TransactionSatisfactionTagValue.TOLERATED.value,
                                ),
                            ],
                        ),
                    ],
                ),
            ],
            "transaction.tolerated",
        )

    @patch("sentry.models.transaction_threshold.ProjectTransactionThresholdOverride.objects.filter")
    @patch("sentry.models.transaction_threshold.ProjectTransactionThreshold.objects.filter")
    def test_project_threshold_called_once_with_valid_cache(self, threshold_override, threshold):
        satisfaction_count_transaction(
            [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
        )
        tolerated_count_transaction(
            [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
        )
        all_transactions(
            [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
        )

        # We check whether we will call the database only for the first snql resolution.
        threshold_override.assert_called_once()
        threshold.assert_called_once()

    @patch("sentry.models.transaction_threshold.ProjectTransactionThresholdOverride.objects.filter")
    @patch("sentry.models.transaction_threshold.ProjectTransactionThreshold.objects.filter")
    def test_project_threshold_called_each_time_with_invalid_cache(
        self, threshold_override, threshold
    ):
        with patch.object(cache, "get", return_value=None):
            satisfaction_count_transaction(
                [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
            )
            tolerated_count_transaction(
                [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
            )
            all_transactions(
                [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
            )

            # We check whether we will call the database for each snql resolution.
            assert threshold_override.call_count == 3
            assert threshold.call_count == 3

    def test_project_thresholds_are_cached(self):
        ProjectTransactionThresholdOverride.objects.create(
            transaction="foo_transaction",
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        expected_threshold_override_config = list(
            ProjectTransactionThresholdOverride.objects.filter(
                project_id__in=[self.project.id],
                organization_id=self.organization.id,
            )
            .order_by("project_id")
            .values_list("transaction", "project_id", "metric")
        )
        threshold_override_cache_key = get_project_threshold_cache_key(
            "sentry_projecttransactionthresholdoverride",
            [self.project.id],
            self.organization.id,
            ["project_id"],
            ["transaction", "project_id", "metric"],
        )

        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )
        expected_threshold_config = list(
            ProjectTransactionThreshold.objects.filter(
                project_id__in=[self.project.id],
                organization_id=self.organization.id,
            )
            .order_by("project_id")
            .values_list("project_id", "metric")
        )
        threshold_cache_key = get_project_threshold_cache_key(
            "sentry_projecttransactionthreshold",
            [self.project.id],
            self.organization.id,
            ["project_id"],
            ["project_id", "metric"],
        )

        all_transactions(
            [self.project.id], self.organization.id, self.metric_ids, "transaction.tolerated"
        )

        assert cache.get(threshold_override_cache_key) == expected_threshold_override_config
        assert cache.get(threshold_cache_key) == expected_threshold_config

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
        all = all_transactions([self.project.id], self.org_id, self.metric_ids, "transactions.all")

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
                        resolve_tag_key(UseCaseID.SESSIONS, self.org_id, "session.status"),
                    ),
                    resolve_tag_value(UseCaseID.SESSIONS, self.org_id, "exited"),
                ),
            )
        ]

    def test_rate_snql(self):
        assert rate_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            numerator=3600,
            denominator=60,
            alias="rate_alias",
        ) == Function(
            "divide",
            [
                Function(
                    "countIf", [Column("value"), Function("equals", [Column("metric_id"), 5])]
                ),
                Function("divide", [3600, 60]),
            ],
            alias="rate_alias",
        )

        assert rate_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            numerator=3600,
            alias="rate_alias",
        ) == Function(
            "divide",
            [
                Function(
                    "countIf", [Column("value"), Function("equals", [Column("metric_id"), 5])]
                ),
                Function("divide", [3600, 1]),
            ],
            alias="rate_alias",
        )

    def test_count_web_vitals_snql(self):
        assert count_web_vitals_snql_factory(
            aggregate_filter=Function(
                "equals",
                [Column("metric_id"), 5],
            ),
            org_id=self.org_id,
            measurement_rating="good",
            alias="count_web_vitals_alias",
        ) == Function(
            "countIf",
            [
                Column("value"),
                Function(
                    "and",
                    [
                        Function(
                            "equals",
                            [Column("metric_id"), 5],
                        ),
                        Function(
                            "equals",
                            (
                                Column(
                                    resolve_tag_key(
                                        UseCaseID.TRANSACTIONS, self.org_id, "measurement_rating"
                                    )
                                ),
                                resolve_tag_value(UseCaseID.TRANSACTIONS, self.org_id, "good"),
                            ),
                        ),
                    ],
                ),
            ],
            alias="count_web_vitals_alias",
        )
