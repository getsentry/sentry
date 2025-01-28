from __future__ import annotations

import datetime
import math
from datetime import timezone
from unittest import mock

import pytest
from snuba_sdk import AliasedExpression, Column, Condition, Function, Op

from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder.metrics import (
    AlertMetricsQueryBuilder,
    HistogramMetricQueryBuilder,
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.types import HistogramParams, ParamsType, QueryBuilderConfig
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.aggregation_option_registry import AggregationOption
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_value
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.extraction import (
    QUERY_HASH_KEY,
    SPEC_VERSION_TWO_FLAG,
    MetricSpecType,
    OnDemandMetricSpec,
)
from sentry.snuba.metrics.naming_layer import TransactionMetricKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.discover import user_misery_formula

pytestmark = pytest.mark.sentry_metrics


def _metric_percentile_definition(
    org_id: int, quantile: str, field: str = "transaction.duration", alias: str | None = None
) -> Function:
    if alias is None:
        alias = f"p{quantile}_{field.replace('.', '_')}"
    return Function(
        "arrayElement",
        [
            Function(
                f"quantilesIf(0.{quantile.rstrip('0')})",
                [
                    Column("value"),
                    Function(
                        "equals",
                        [
                            Column("metric_id"),
                            indexer.resolve(
                                UseCaseID.TRANSACTIONS, org_id, constants.METRICS_MAP[field]
                            ),
                        ],
                    ),
                ],
            ),
            1,
        ],
        alias,
    )


def _metric_conditions(org_id: int, metrics: list[str]) -> list[Condition]:
    def _resolve_must_succeed(*a, **k):
        ret = indexer.resolve(*a, **k)
        assert ret is not None
        return ret

    return [
        Condition(
            Column("metric_id"),
            Op.IN,
            sorted(
                _resolve_must_succeed(UseCaseID.TRANSACTIONS, org_id, constants.METRICS_MAP[metric])
                for metric in metrics
            ),
        )
    ]


class MetricBuilderBaseTest(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = [
        "foo_transaction",
        "bar_transaction",
        "baz_transaction",
        "measurements.custom.measurement",
    ]
    DEFAULT_METRIC_TIMESTAMP = datetime.datetime(
        2015, 1, 1, 10, 15, 0, tzinfo=timezone.utc
    ) + datetime.timedelta(minutes=1)

    def setUp(self):
        super().setUp()
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) - datetime.timedelta(days=18)
        self.end = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.projects = [self.project.id]
        self.params: ParamsType = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }
        # These conditions should always be on a query when self.params is passed
        self.default_conditions = [
            Condition(Column("timestamp"), Op.GTE, self.start),
            Condition(Column("timestamp"), Op.LT, self.end),
            Condition(Column("project_id"), Op.IN, self.projects),
            Condition(Column("org_id"), Op.EQ, self.organization.id),
        ]

        self.expected_tag_value_type = "String"

        indexer.record(
            use_case_id=UseCaseID.TRANSACTIONS, org_id=self.organization.id, string="transaction"
        )

    def setup_orderby_data(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            50,
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            2,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )

    def build_transaction_transform(self, alias):
        return Function(
            "transform",
            [
                Column(
                    f"tags_raw[{indexer.resolve(UseCaseID.TRANSACTIONS, self.organization.id, 'transaction')}]"
                ),
                [""],
                ["<< unparameterized >>"],
            ],
            alias,
        )


class MetricQueryBuilderTest(MetricBuilderBaseTest):
    @pytest.mark.querybuilder
    def test_default_conditions(self):
        query = MetricsQueryBuilder(
            self.params, query="", dataset=Dataset.PerformanceMetrics, selected_columns=[]
        )
        self.assertCountEqual(query.where, self.default_conditions)

    def test_column_resolution(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["tags[transaction]", "transaction"],
        )
        self.assertCountEqual(
            query.columns,
            [
                self.build_transaction_transform("tags[transaction]"),
                self.build_transaction_transform("transaction"),
            ],
        )

    def test_simple_aggregates(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50(transaction.duration)",
                "p75(measurements.lcp)",
                "p90(measurements.fcp)",
                "p95(measurements.cls)",
                "p99(measurements.fid)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                        "measurements.lcp",
                        "measurements.fcp",
                        "measurements.cls",
                        "measurements.fid",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                _metric_percentile_definition(self.organization.id, "50"),
                _metric_percentile_definition(self.organization.id, "75", "measurements.lcp"),
                _metric_percentile_definition(self.organization.id, "90", "measurements.fcp"),
                _metric_percentile_definition(self.organization.id, "95", "measurements.cls"),
                _metric_percentile_definition(self.organization.id, "99", "measurements.fid"),
            ],
        )

    def test_custom_percentile_throws_error(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "percentile(transaction.duration, 0.11)",
                ],
            )

    def test_percentile_function(self):
        self.maxDiff = None
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "percentile(transaction.duration, 0.75)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                Function(
                    "arrayElement",
                    [
                        Function(
                            "quantilesIf(0.75)",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        indexer.resolve(
                                            UseCaseID.TRANSACTIONS,
                                            self.organization.id,
                                            constants.METRICS_MAP["transaction.duration"],
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        1,
                    ],
                    "percentile_transaction_duration_0_75",
                )
            ],
        )

    def test_metric_condition_dedupe(self):
        org_id = 1
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50(transaction.duration)",
                "p75(transaction.duration)",
                "p90(transaction.duration)",
                "p95(transaction.duration)",
                "p99(transaction.duration)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(org_id, ["transaction.duration"]),
            ],
        )

    def test_p100(self):
        """While p100 isn't an actual quantile in the distributions table, its equivalent to max"""
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p100(transaction.duration)",
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(
                    self.organization.id,
                    [
                        "transaction.duration",
                    ],
                ),
            ],
        )
        self.assertCountEqual(
            query.distributions,
            [
                Function(
                    "maxIf",
                    [
                        Column("value"),
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                indexer.resolve(
                                    UseCaseID.TRANSACTIONS,
                                    self.organization.id,
                                    constants.METRICS_MAP["transaction.duration"],
                                ),
                            ],
                        ),
                    ],
                    "p100_transaction_duration",
                )
            ],
        )

    def test_grouping(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )
        transaction = self.build_transaction_transform("transaction")
        project = AliasedExpression(
            Column("project_id"),
            "project",
        )
        self.assertCountEqual(
            query.groupby,
            [
                transaction,
                project,
            ],
        )
        self.assertCountEqual(
            query.distributions, [_metric_percentile_definition(self.organization.id, "95")]
        )

    def test_transaction_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            query="transaction:foo_transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        transaction_name = resolve_tag_value(
            UseCaseID.TRANSACTIONS, self.organization.id, "foo_transaction"
        )
        transaction = self.build_transaction_transform("transaction")
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.EQ, transaction_name),
            ],
        )

    def test_transaction_in_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            query="transaction:[foo_transaction, bar_transaction]",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        transaction_name1 = resolve_tag_value(
            UseCaseID.TRANSACTIONS, self.organization.id, "foo_transaction"
        )
        transaction_name2 = resolve_tag_value(
            UseCaseID.TRANSACTIONS, self.organization.id, "bar_transaction"
        )
        transaction = self.build_transaction_transform("transaction")
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.IN, [transaction_name1, transaction_name2]),
            ],
        )

    def test_incorrect_parameter_for_metrics(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query=f"project:{self.project.slug}",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=["transaction", "count_unique(test)"],
            )

    def test_project_filter(self):
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["transaction", "project", "p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(Column("project_id"), Op.EQ, self.project.id),
            ],
        )

    def test_limit_validation(self):
        # 51 is ok
        MetricsQueryBuilder(self.params, limit=51)
        # None is ok, defaults to 50
        query = MetricsQueryBuilder(self.params)
        assert query.limit is not None
        assert query.limit.limit == 50
        # anything higher should throw an error
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(self.params, limit=10_000)

    def test_granularity(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "A day at midnight"

        # If we're doing several days, allow more range
        start = datetime.datetime(2015, 5, 18, 0, 10, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 23, 59, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Several days"

        # We're doing a long period, use the biggest granularity
        start = datetime.datetime(2015, 5, 18, 12, 33, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 7, 28, 17, 22, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "Big range"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour"

        # If we're close to the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 21, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, close"

        # A decently long period but not close to hour ends, still use hour bucket
        start = datetime.datetime(2015, 5, 18, 23, 3, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 28, 1, 57, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "On the hour, long period"

        # Hour to hour should only happen at the precise hour
        start = datetime.datetime(2015, 5, 18, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "precisely hour to hour"

        # Even a few seconds means we need to switch back to minutes since the latter bucket may not be filled
        start = datetime.datetime(2015, 5, 18, 10, 0, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 0, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "hour to hour but with seconds"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 18, 15, 1, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "A few hours, but random minute"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 18, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 60, "less than a minute"

    def test_granularity_boundaries(self):
        # Need to pick granularity based on the period
        def get_granularity(start, end):
            params = {
                "organization_id": self.organization.id,
                "project_id": self.projects,
                "start": start,
                "end": end,
            }
            query = MetricsQueryBuilder(params)
            return query.granularity.granularity

        # See resolve_granularity on the MQB to see what these boundaries are

        # Exactly 30d, at the 30 minute boundary
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "30d at boundary"

        # Near 30d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 30, 23, 29, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour before boundary for end"

        # Near 30d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 31, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 30d, but 1 hour after boundary for start"

        # Exactly 3d
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 30, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 86400, "3d at boundary"

        # Near 3d, but 1 hour before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 13, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 3, 23, 45, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour before boundary for end"

        # Near 3d, but 1 hour after the boundary for start
        start = datetime.datetime(2015, 5, 1, 1, 46, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 4, 0, 46, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "near 3d, but 1 hour after boundary for start"

        # exactly 12 hours
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end) == 3600, "12h at boundary"

        # Near 12h, but 15 minutes before the boundary for end
        start = datetime.datetime(2015, 5, 1, 0, 15, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end) == 60
        ), "12h at boundary, but 15 min before the boundary for end"

        # Near 12h, but 15 minutes after the boundary for start
        start = datetime.datetime(2015, 5, 1, 0, 30, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 1, 12, 15, 0, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end) == 60
        ), "12h at boundary, but 15 min after the boundary for start"

    def test_get_snql_query(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p90(transaction.duration)"],
        )
        snql_request = query.get_snql_query()
        assert snql_request.dataset == "generic_metrics"
        snql_query = snql_request.query
        self.assertCountEqual(
            snql_query.select,
            [
                _metric_percentile_definition(self.organization.id, "90"),
            ],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )

    def test_get_snql_query_errors_with_multiple_dataset(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p90(transaction.duration)", "count_unique(user)"],
        )
        with pytest.raises(NotImplementedError):
            query.get_snql_query()

    def test_get_snql_query_errors_with_no_functions(self):
        query = MetricsQueryBuilder(
            self.params, query="", dataset=Dataset.PerformanceMetrics, selected_columns=["project"]
        )
        with pytest.raises(IncompatibleMetricsQuery):
            query.get_snql_query()

    def test_run_query(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            100,
            metric="measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1000,
            metric="measurements.lcp",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
                "p100(measurements.lcp)",
            ],
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "p95_transaction_duration": 100,
            "p100_measurements_lcp": 1000,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "p100_measurements_lcp", "type": "Float64"},
            ],
        )

    def test_run_query_multiple_tables(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_multiple_groupby_orderby_distribution(self):
        self.setup_orderby_data()
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="-p95(transaction.duration)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_multiple_groupby_orderby_set(self):
        self.setup_orderby_data()
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="-count_unique(user)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_project_orderby(self):
        project_1 = self.create_project(slug="aaaaaa")
        project_2 = self.create_project(slug="zzzzzz")
        for project in [project_1, project_2]:
            self.store_transaction_metric(
                100,
                tags={"transaction": "foo_transaction"},
                project=project.id,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        self.params["project_id"] = [project_1.id, project_2.id]

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
            ],
            orderby="project",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_1.id,
            "p95_transaction_duration": 100,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_2.id,
            "p95_transaction_duration": 100,
        }

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
            ],
            orderby="-project",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 2
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_2.id,
            "p95_transaction_duration": 100,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": project_1.id,
            "p95_transaction_duration": 100,
        }

    def test_run_query_with_transactions_orderby(self):
        for transaction_name in ["aaa", "zzz", "bbb"]:
            self.store_transaction_metric(
                100,
                tags={"transaction": transaction_name},
                project=self.project.id,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
            ],
            orderby="-transaction",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 3
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "zzz",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
        }

        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "bbb",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
        }

    # TODO: multiple groupby with counter

    def test_run_query_with_events_per_aggregates(self):
        for i in range(5):
            self.store_transaction_metric(
                100, timestamp=self.start + datetime.timedelta(minutes=i * 15)
            )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "eps()",
                "epm()",
                "tps()",
                "tpm()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        # Check the aliases are correct
        assert data["epm"] == data["tpm"]
        assert data["eps"] == data["tps"]
        # Check the values are correct
        assert data["tpm"] == 5 / ((self.end - self.start).total_seconds() / 60)
        assert data["tpm"] / 60 == data["tps"]

    def test_count(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "count()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["count"] == 6

    def test_avg_duration(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "avg(transaction.duration)",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["avg_transaction_duration"] == 100

    def test_avg_span_http(self):
        for _ in range(3):
            self.store_transaction_metric(
                150,
                metric="spans.http",
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                50,
                metric="spans.http",
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "avg(spans.http)",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["avg_spans_http"] == 100

    def test_failure_rate(self):
        for _ in range(3):
            self.store_transaction_metric(
                100,
                tags={"transaction.status": "internal_error"},
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
            self.store_transaction_metric(
                100,
                tags={"transaction.status": "ok"},
                timestamp=self.start + datetime.timedelta(minutes=5),
            )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "failure_rate()",
                "failure_count()",
            ],
        )
        result = query.run_query("test_query")
        data = result["data"][0]
        assert data["failure_rate"] == 0.5
        assert data["failure_count"] == 3

    def test_run_function_without_having_or_groupby(self):
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "count_unique(user)",
            ],
        )
        primary, result = query._create_query_framework()
        assert primary == "set"

    def test_run_query_with_multiple_groupby_orderby_null_values_in_second_entity(self):
        """Since the null value is on count_unique(user) we will still get baz_transaction since we query distributions
        first which will have it, and then just not find a unique count in the second"""
        self.setup_orderby_data()
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="p95(transaction.duration)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 3
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][2] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 0,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    @pytest.mark.skip(
        reason="Currently cannot handle the case where null values are in the first entity"
    )
    def test_run_query_with_multiple_groupby_orderby_null_values_in_first_entity(self):
        """But if the null value is in the first entity, it won't show up in the groupby values, which means the
        transaction will be missing"""
        self.setup_orderby_data()
        self.store_transaction_metric(200, tags={"transaction": "baz_transaction"})
        query = MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug}",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby="count_unique(user)",
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 3
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
        }
        assert result["data"][1] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "foo_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 100,
            "count_unique_user": 1,
        }
        assert result["data"][2] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "bar_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 50,
            "count_unique_user": 2,
        }

    def test_multiple_entity_orderby_fails(self):
        with pytest.raises(IncompatibleMetricsQuery):
            query = MetricsQueryBuilder(
                self.params,
                query=f"project:{self.project.slug}",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                orderby=["-count_unique(user)", "p95(transaction.duration)"],
            )
            query.run_query("test_query")

    def test_multiple_entity_query_fails(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="p95(transaction.duration):>5s AND count_unique(user):>0",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                config=QueryBuilderConfig(
                    use_aggregate_conditions=True,
                ),
            )

    def test_query_entity_does_not_match_orderby(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="count_unique(user):>0",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[
                    "transaction",
                    "project",
                    "p95(transaction.duration)",
                    "count_unique(user)",
                ],
                orderby=["p95(transaction.duration)"],
                config=QueryBuilderConfig(
                    use_aggregate_conditions=True,
                ),
            )

    def test_aggregate_query_with_multiple_entities_without_orderby(self):
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            2,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        # This will query both sets & distribution cause of selected columns
        query = MetricsQueryBuilder(
            self.params,
            # Filter by count_unique since the default primary is distributions without an orderby
            query="count_unique(user):>1",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            config=QueryBuilderConfig(
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
            ),
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 2,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_aggregate_query_with_multiple_entities_with_orderby(self):
        self.store_transaction_metric(
            200,
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            tags={"transaction": "bar_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        self.store_transaction_metric(
            1,
            metric="user",
            tags={"transaction": "baz_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
        )
        # This will query both sets & distribution cause of selected columns
        query = MetricsQueryBuilder(
            self.params,
            query="p95(transaction.duration):>100",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "project",
                "p95(transaction.duration)",
                "count_unique(user)",
            ],
            orderby=["p95(transaction.duration)"],
            config=QueryBuilderConfig(
                allow_metric_aggregates=True,
                use_aggregate_conditions=True,
            ),
        )
        result = query.run_query("test_query")
        assert len(result["data"]) == 1
        assert result["data"][0] == {
            "transaction": resolve_tag_value(
                UseCaseID.TRANSACTIONS,
                self.organization.id,
                "baz_transaction",
            ),
            "project": self.project.id,
            "p95_transaction_duration": 200,
            "count_unique_user": 1,
        }
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "transaction", "type": self.expected_tag_value_type},
                {"name": "project", "type": "UInt64"},
                {"name": "p95_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_invalid_column_arg(self):
        for function in [
            "count_unique(transaction.duration)",
            "count_miserable(measurements.fcp)",
            "p75(user)",
            "count_web_vitals(user, poor)",
        ]:
            with pytest.raises(IncompatibleMetricsQuery):
                MetricsQueryBuilder(
                    self.params,
                    query="",
                    dataset=Dataset.PerformanceMetrics,
                    selected_columns=[function],
                )

    def test_orderby_field_alias(self):
        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
            ],
            orderby=["p95"],
        )
        assert len(query.orderby) == 1
        assert query.orderby[0].exp == _metric_percentile_definition(
            self.organization.id, "95", "transaction.duration", "p95"
        )

        query = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95() as test",
            ],
            orderby=["test"],
        )
        assert len(query.orderby) == 1
        assert query.orderby[0].exp == _metric_percentile_definition(
            self.organization.id, "95", "transaction.duration", "test"
        )

    def test_error_if_aggregates_disallowed(self):
        def run_query(query, use_aggregate_conditions):
            with pytest.raises(IncompatibleMetricsQuery):
                MetricsQueryBuilder(
                    self.params,
                    dataset=Dataset.PerformanceMetrics,
                    selected_columns=[
                        "transaction",
                        "p95()",
                        "count_unique(user)",
                    ],
                    query=query,
                    config=QueryBuilderConfig(
                        allow_metric_aggregates=False,
                        use_aggregate_conditions=use_aggregate_conditions,
                    ),
                )

        queries = [
            "p95():>5s",
            "count_unique(user):>0",
            "transaction:foo_transaction AND (!transaction:bar_transaction OR p95():>5s)",
        ]
        for query in queries:
            for use_aggregate_conditions in [True, False]:
                run_query(query, use_aggregate_conditions)

    def test_no_error_if_aggregates_disallowed_but_no_aggregates_included(self):
        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            config=QueryBuilderConfig(
                allow_metric_aggregates=False,
                use_aggregate_conditions=True,
            ),
        )

        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "p95()",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            config=QueryBuilderConfig(
                allow_metric_aggregates=False,
                use_aggregate_conditions=False,
            ),
        )

    def test_multiple_dataset_but_no_data(self):
        """When there's no data from the primary dataset we shouldn't error out"""
        result = MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p50()",
                "count_unique(user)",
            ],
            config=QueryBuilderConfig(
                allow_metric_aggregates=False,
                use_aggregate_conditions=True,
            ),
        ).run_query("test")
        assert len(result["data"]) == 1
        data = result["data"][0]
        assert data["count_unique_user"] == 0
        # Handled by the discover transform later so its fine that this is nan
        assert math.isnan(data["p50"])

    @mock.patch("sentry.search.events.builder.metrics.indexer.resolve", return_value=-1)
    def test_multiple_references_only_resolve_index_once(self, mock_indexer):
        MetricsQueryBuilder(
            self.params,
            query=f"project:{self.project.slug} transaction:foo_transaction transaction:foo_transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
                "count_web_vitals(measurements.lcp, good)",
            ],
        )

        expected = [mock.call(UseCaseID.TRANSACTIONS, self.organization.id, "transaction")]

        expected.extend(
            [
                mock.call(
                    UseCaseID.TRANSACTIONS,
                    self.organization.id,
                    constants.METRICS_MAP["measurements.lcp"],
                ),
                mock.call(UseCaseID.TRANSACTIONS, self.organization.id, "measurement_rating"),
            ]
        )

        self.assertCountEqual(mock_indexer.mock_calls, expected)

    def test_custom_measurement_allowed(self):
        MetricsQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "transaction",
                "avg(measurements.custom.measurement)",
                "p50(measurements.custom.measurement)",
                "p75(measurements.custom.measurement)",
                "p90(measurements.custom.measurement)",
                "p95(measurements.custom.measurement)",
                "p99(measurements.custom.measurement)",
                "p100(measurements.custom.measurement)",
                "percentile(measurements.custom.measurement, 0.95)",
                "sum(measurements.custom.measurement)",
                "max(measurements.custom.measurement)",
                "min(measurements.custom.measurement)",
                "count_unique(user)",
            ],
            query="transaction:foo_transaction",
            config=QueryBuilderConfig(
                allow_metric_aggregates=False,
                use_aggregate_conditions=True,
            ),
        )

    def test_group_by_not_in_select(self):
        query = MetricsQueryBuilder(
            self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[
                "p90(transaction.duration)",
                "project",
            ],
            groupby_columns=[
                "transaction",
            ],
        )
        snql_query = query.get_snql_query().query
        project = AliasedExpression(
            Column("project_id"),
            "project",
        )
        self.assertCountEqual(
            snql_query.select,
            [
                _metric_percentile_definition(self.organization.id, "90"),
                project,
            ],
        )
        self.assertCountEqual(
            snql_query.groupby,
            [project, self.build_transaction_transform("transaction")],
        )

    def test_missing_function(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="",
                selected_columns=[
                    "count_all_the_things_that_i_want()",
                    "transaction",
                ],
                groupby_columns=[
                    "transaction",
                ],
            )

    def test_event_type_query_condition(self):
        query = MetricsQueryBuilder(
            self.params,
            query="event.type:transaction",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[],
        )
        self.assertCountEqual(query.where, self.default_conditions)

    def test_invalid_event_type_query_condition(self):
        with pytest.raises(IncompatibleMetricsQuery):
            MetricsQueryBuilder(
                self.params,
                query="!event.type:transaction",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[],
            )

    @mock.patch(
        "sentry.search.events.datasets.metrics.MetricsDatasetConfig.function_converter",
        new_callable=mock.PropertyMock,
        return_value={
            "count_unique": fields.MetricsFunction(
                "count_unique",
                required_args=[fields.MetricArg("column", allowed_columns=["mocked_gauge"])],
                snql_set=lambda args, alias: None,  # Doesn't matter what this returns
            )
        },
    )
    @mock.patch.dict(
        "sentry.search.events.builder.metrics.constants.METRICS_MAP",
        {"mocked_gauge": "g:mock/mocked_gauge@none"},
    )
    def test_missing_function_implementation_for_metric_type(self, _mocked_function_converter):
        # Mocks count_unique to allow the mocked_gauge column
        # but the metric type does not have a gauge implementation
        with pytest.raises(IncompatibleMetricsQuery) as err:
            MetricsQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                query="",
                selected_columns=[
                    "count_unique(mocked_gauge)",
                ],
            )

        assert str(err.value) == "The functions provided do not match the requested metric type"

    def test_free_text_search(self):
        query = MetricsQueryBuilder(
            self.params,
            dataset=None,
            query="foo",
            selected_columns=["count()"],
        )

        self.maxDiff = 100000

        transaction_key = indexer.resolve(
            UseCaseID.TRANSACTIONS, self.organization.id, "transaction"
        )
        self.assertCountEqual(
            query.where,
            [
                Condition(
                    Function(
                        "positionCaseInsensitive",
                        [
                            Column(f"tags[{transaction_key}]"),
                            "foo",
                        ],
                    ),
                    Op.NEQ,
                    0,
                ),
                Condition(
                    Column("metric_id"),
                    Op.IN,
                    [
                        indexer.resolve(
                            UseCaseID.TRANSACTIONS,
                            self.organization.id,
                            "d:transactions/duration@millisecond",
                        )
                    ],
                ),
                *self.default_conditions,
            ],
        )


class TimeseriesMetricQueryBuilderTest(MetricBuilderBaseTest):
    @pytest.mark.querybuilder
    def test_get_query(self):
        orig_query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=["p50(transaction.duration)"],
        )
        snql_query = orig_query.get_snql_query()
        assert len(snql_query) == 1
        query = snql_query[0].query
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
            ],
        )
        assert query.select == [_metric_percentile_definition(self.organization.id, "50")]
        assert query.match.name == "generic_metrics_distributions"
        assert query.granularity.granularity == 60

    def test_default_conditions(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=[],
        )
        self.assertCountEqual(query.where, self.default_conditions)

    def test_granularity(self):
        # Need to pick granularity based on the period and interval for timeseries
        def get_granularity(start, end, interval):
            query = TimeseriesMetricQueryBuilder(
                {
                    "organization_id": self.organization.id,
                    "project_id": self.projects,
                    "start": start,
                    "end": end,
                },
                interval=interval,
            )
            return query.granularity.granularity

        # If we're doing atleast day and its midnight we should use the daily bucket
        start = datetime.datetime(2015, 5, 18, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 0, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "A day at midnight, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "A day at midnight, 1hr interval"
        assert get_granularity(start, end, 86400) == 86400, "A day at midnight, 1d interval"

        # If we're on the start of the hour we should use the hour granularity
        start = datetime.datetime(2015, 5, 18, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 20, 1, 0, 0, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "On the hour, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "On the hour, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "On the hour, 1d interval"

        # Even though this is >24h of data, because its a random hour in the middle of the day to the next we use minute
        # granularity
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 15, 15, 1, tzinfo=timezone.utc)
        assert (
            get_granularity(start, end, 900) == 60
        ), "A few hours, but random minute, 15min interval"
        assert (
            get_granularity(start, end, 3600) == 3600
        ), "A few hours, but random minute, 1hr interval"
        assert (
            get_granularity(start, end, 86400) == 3600
        ), "A few hours, but random minute, 1d interval"

        # Less than a minute, no reason to work hard for such a small window, just use a minute
        start = datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        end = datetime.datetime(2015, 5, 19, 10, 15, 34, tzinfo=timezone.utc)
        assert get_granularity(start, end, 900) == 60, "less than a minute, 15min interval"
        assert get_granularity(start, end, 3600) == 3600, "less than a minute, 1hr interval"
        assert get_granularity(start, end, 86400) == 3600, "less than a minute, 1d interval"

    def test_transaction_in_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            interval=900,
            dataset=Dataset.PerformanceMetrics,
            query="transaction:[foo_transaction, bar_transaction]",
            selected_columns=["p95(transaction.duration)"],
        )
        transaction_name1 = resolve_tag_value(
            UseCaseID.TRANSACTIONS, self.organization.id, "foo_transaction"
        )
        transaction_name2 = resolve_tag_value(
            UseCaseID.TRANSACTIONS, self.organization.id, "bar_transaction"
        )

        transaction = self.build_transaction_transform("transaction")
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(transaction, Op.IN, [transaction_name1, transaction_name2]),
            ],
        )

    def test_project_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query=f"project:{self.project.slug}",
            selected_columns=["p95(transaction.duration)"],
        )
        self.assertCountEqual(
            query.where,
            [
                *self.default_conditions,
                *_metric_conditions(self.organization.id, ["transaction.duration"]),
                Condition(Column("project_id"), Op.EQ, self.project.id),
            ],
        )

    def test_meta(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
        )
        result = query.run_query("test_query")
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_with_aggregate_filter(self):
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="p50(transaction.duration):>100",
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
            config=QueryBuilderConfig(
                allow_metric_aggregates=True,
            ),
        )
        # Aggregate conditions should be dropped
        assert query.having == []

    def test_run_query(self):
        for i in range(5):
            self.store_transaction_metric(
                100, timestamp=self.start + datetime.timedelta(minutes=i * 15)
            )
            self.store_transaction_metric(
                1,
                metric="user",
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="",
            selected_columns=["p50(transaction.duration)", "count_unique(user)"],
        )
        result = query.run_query("test_query")
        assert result["data"] == [
            {
                "time": self.start.isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=15)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=30)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=45)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=60)).isoformat(),
                "p50_transaction_duration": 100.0,
                "count_unique_user": 1,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
                {"name": "count_unique_user", "type": "UInt64"},
            ],
        )

    def test_run_query_with_hour_interval(self):
        # See comment on resolve_time_column for explanation of this test
        self.start = datetime.datetime.now(timezone.utc).replace(
            hour=15, minute=30, second=0, microsecond=0
        )
        self.end = datetime.datetime.fromtimestamp(self.start.timestamp() + 86400, timezone.utc)
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }

        for i in range(5):
            self.store_transaction_metric(
                100,
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query="",
            selected_columns=["epm(3600)"],
        )
        result = query.run_query("test_query")
        date_prefix = self.start.strftime("%Y-%m-%dT")
        assert result["data"] == [
            {"time": f"{date_prefix}15:00:00+00:00", "epm_3600": 2 / (3600 / 60)},
            {"time": f"{date_prefix}16:00:00+00:00", "epm_3600": 3 / (3600 / 60)},
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "epm_3600", "type": "Float64"},
            ],
        )

    def test_run_query_with_granularity_larger_than_interval(self):
        """The base MetricsQueryBuilder with a perfect 1d query will try to use granularity 86400 which is larger than
        the interval of 3600, in this case we want to make sure to use a smaller granularity to get the correct
        result"""
        self.start = datetime.datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        self.end = datetime.datetime.fromtimestamp(self.start.timestamp() + 86400, timezone.utc)
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }

        for i in range(1, 5):
            self.store_transaction_metric(
                100,
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query="",
            selected_columns=["epm(3600)"],
        )
        result = query.run_query("test_query")
        date_prefix = self.start.strftime("%Y-%m-%dT")
        assert result["data"] == [
            {"time": f"{date_prefix}00:00:00+00:00", "epm_3600": 3 / (3600 / 60)},
            {"time": f"{date_prefix}01:00:00+00:00", "epm_3600": 1 / (3600 / 60)},
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "epm_3600", "type": "Float64"},
            ],
        )

    def test_run_query_with_filter(self):
        for i in range(5):
            self.store_transaction_metric(
                100,
                tags={"transaction": "foo_transaction"},
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
            self.store_transaction_metric(
                200,
                tags={"transaction": "bar_transaction"},
                timestamp=self.start + datetime.timedelta(minutes=i * 15),
            )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=900,
            query="transaction:foo_transaction",
            selected_columns=["p50(transaction.duration)"],
        )
        result = query.run_query("test_query")
        assert result["data"] == [
            {"time": self.start.isoformat(), "p50_transaction_duration": 100.0},
            {
                "time": (self.start + datetime.timedelta(minutes=15)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=30)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=45)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(minutes=60)).isoformat(),
                "p50_transaction_duration": 100.0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p50_transaction_duration", "type": "Float64"},
            ],
        )

    def test_error_if_aggregates_disallowed(self):
        def run_query(query):
            with pytest.raises(IncompatibleMetricsQuery):
                TimeseriesMetricQueryBuilder(
                    self.params,
                    interval=900,
                    dataset=Dataset.PerformanceMetrics,
                    query=query,
                    selected_columns=["p50(transaction.duration)"],
                    config=QueryBuilderConfig(
                        allow_metric_aggregates=False,
                    ),
                )

        queries = [
            "p95():>5s",
            "count_unique(user):>0",
            "transaction:foo_transaction AND (!transaction:bar_transaction OR p95():>5s)",
        ]
        for query in queries:
            run_query(query)

    def test_no_error_if_aggregates_disallowed_but_no_aggregates_included(self):
        TimeseriesMetricQueryBuilder(
            self.params,
            interval=900,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p50(transaction.duration)"],
            query="transaction:foo_transaction",
            config=QueryBuilderConfig(
                allow_metric_aggregates=False,
            ),
        )

    def test_run_query_with_on_demand_count(self):
        field = "count()"
        query_s = "transaction.duration:>0"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        for hour in range(0, 5):
            self.store_transaction_metric(
                value=hour * 100,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:5] == [
            {
                "time": self.start.isoformat(),
                "count": 0.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "count": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "count": 200.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=3)).isoformat(),
                "count": 300.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=4)).isoformat(),
                "count": 400.0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "count", "type": "Float64"},
            ],
        )

    # Once we delete the current spec version this test will fail and we can delete it
    def test_on_demand_builder_with_new_spec(self):
        field = "count()"
        query = "transaction.duration:>0"
        spec = OnDemandMetricSpec(field=field, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY)
        # As expected, it does not include the environment tag
        expected_str_hash = "None;{'name': 'event.duration', 'op': 'gt', 'value': 0.0}"
        assert spec._query_str_for_hash == expected_str_hash

        # Because we call the builder with the feature flag we will get the environment to be included
        with Feature(SPEC_VERSION_TWO_FLAG):
            query_builder = TimeseriesMetricQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                interval=3600,
                query=query,
                selected_columns=[field],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY,
                ),
            )
            spec_in_use: OnDemandMetricSpec | None = (
                query_builder._on_demand_metric_spec_map[field]
                if query_builder._on_demand_metric_spec_map
                else None
            )
            assert spec_in_use
            # It does include the environment tag
            assert spec_in_use._query_str_for_hash == f"{expected_str_hash};['environment']"
            # This proves that we're picking up the new spec version
            assert spec_in_use.spec_version.flags == {"include_environment_tag"}

    def test_on_demand_builder_with_not_event_type_error(self):
        field = "count()"
        query = "!event.type:error"
        spec = OnDemandMetricSpec(field=field, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY)
        expected_str_hash = "None;{'inner': {'name': 'event.tags.event.type', 'op': 'eq', 'value': 'error'}, 'op': 'not'}"
        assert spec._query_str_for_hash == expected_str_hash

        query_builder = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY,
            ),
        )
        spec_map = query_builder._on_demand_metric_spec_map
        assert spec_map
        assert spec_map.get(field) == spec
        assert query_builder.dataset.name == "PerformanceMetrics"
        assert query_builder.dataset.value == "generic_metrics"

    def test_on_demand_builder_with_event_type_error(self):
        field = "count()"
        query = "event.type:error"
        spec = OnDemandMetricSpec(field=field, query=query, spec_type=MetricSpecType.DYNAMIC_QUERY)
        expected_str_hash = "None;{'name': 'event.tags.event.type', 'op': 'eq', 'value': 'error'}"
        assert spec._query_str_for_hash == expected_str_hash

        with pytest.raises(IncompatibleMetricsQuery):
            TimeseriesMetricQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                interval=3600,
                query=query,
                selected_columns=[field],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY,
                ),
            )

    def test_run_query_with_on_demand_distribution_and_environment(self):
        field = "p75(measurements.fp)"
        query_s = "transaction.duration:>0"
        spec = OnDemandMetricSpec(
            field=field, query=query_s, environment="prod", spec_type=MetricSpecType.SIMPLE_QUERY
        )

        self.create_environment(project=self.project, name="prod")

        for hour in range(0, 5):
            self.store_transaction_metric(
                value=hour * 100,
                metric=TransactionMetricKey.DIST_ON_DEMAND.value,
                internal_metric=TransactionMRI.DIST_ON_DEMAND.value,
                entity="metrics_distributions",
                tags={"query_hash": spec.query_hash},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )

        query = TimeseriesMetricQueryBuilder(
            {**self.params, "environment": ["prod"]},
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:5] == [
            {
                "time": self.start.isoformat(),
                "p75_measurements_fp": 0.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "p75_measurements_fp": 100.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "p75_measurements_fp": 200.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=3)).isoformat(),
                "p75_measurements_fp": 300.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=4)).isoformat(),
                "p75_measurements_fp": 400.0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "p75_measurements_fp", "type": "Float64"},
            ],
        )

    def test_run_query_with_on_demand_failure_count(self):
        field = "failure_count()"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)
        timestamp = self.start
        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash, "failure": "true"},
            timestamp=timestamp,
        )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:1] == [{"time": timestamp.isoformat(), "failure_count": 1.0}]
        assert result["meta"] == [
            {"name": "time", "type": "DateTime('Universal')"},
            {"name": "failure_count", "type": "Float64"},
        ]

    def test_run_query_with_on_demand_failure_rate(self):
        field = "failure_rate()"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        for hour in range(0, 5):
            # 1 per hour failed
            self.store_transaction_metric(
                value=1,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash, "failure": "true"},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )

            # 4 per hour successful
            for j in range(0, 4):
                self.store_transaction_metric(
                    value=1,
                    metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                    internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                    entity="metrics_counters",
                    tags={"query_hash": spec.query_hash},
                    timestamp=self.start + datetime.timedelta(hours=hour),
                )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:5] == [
            {
                "time": self.start.isoformat(),
                "failure_rate": 0.2,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "failure_rate": 0.2,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "failure_rate": 0.2,
            },
            {
                "time": (self.start + datetime.timedelta(hours=3)).isoformat(),
                "failure_rate": 0.2,
            },
            {
                "time": (self.start + datetime.timedelta(hours=4)).isoformat(),
                "failure_rate": 0.2,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "failure_rate", "type": "Float64"},
            ],
        )

    def test_run_query_with_on_demand_apdex(self):
        field = "apdex(10)"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        for hour in range(0, 5):
            self.store_transaction_metric(
                value=1,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash, "satisfaction": "satisfactory"},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )

            for j in range(0, 4):
                self.store_transaction_metric(
                    value=1,
                    metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                    internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                    entity="metrics_counters",
                    tags={"query_hash": spec.query_hash, "satisfaction": "tolerable"},
                    timestamp=self.start + datetime.timedelta(hours=hour),
                )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:5] == [
            {
                "time": self.start.isoformat(),
                "apdex_10": 0.6,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "apdex_10": 0.6,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "apdex_10": 0.6,
            },
            {
                "time": (self.start + datetime.timedelta(hours=3)).isoformat(),
                "apdex_10": 0.6,
            },
            {
                "time": (self.start + datetime.timedelta(hours=4)).isoformat(),
                "apdex_10": 0.6,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "apdex_10", "type": "Float64"},
            ],
        )

    def test_run_query_with_on_demand_count_web_vitals(self):
        field = "count_web_vitals(measurements.lcp, good)"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        for hour in range(0, 5):
            self.store_transaction_metric(
                value=hour * 10,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash, "measurement_rating": "matches_hash"},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )
            # These should not add to the total
            self.store_transaction_metric(
                value=hour * 10,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash},
                timestamp=self.start + datetime.timedelta(hours=hour),
            )

        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
            ),
        )

        assert query._on_demand_metric_spec_map
        selected_spec = query._on_demand_metric_spec_map[field]
        metrics_query = query._get_metrics_query_from_on_demand_spec(
            spec=selected_spec, require_time_range=True
        )

        assert len(metrics_query.select) == 1
        assert metrics_query.select[0].op == "on_demand_count_web_vitals"

        assert metrics_query.where
        assert (
            metrics_query.where[0].rhs == "d8e708b0"
        )  # hashed "on_demand_count_web_vitals:measurements.lcp:good;{'name': 'event.duration', 'op': 'gte', 'value': 100.0}"

        result = query.run_query("test_query")
        assert result["data"][:5] == [
            {
                "time": self.start.isoformat(),
                "count_web_vitals_measurements_lcp_good": 0.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "count_web_vitals_measurements_lcp_good": 10.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "count_web_vitals_measurements_lcp_good": 20.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=3)).isoformat(),
                "count_web_vitals_measurements_lcp_good": 30.0,
            },
            {
                "time": (self.start + datetime.timedelta(hours=4)).isoformat(),
                "count_web_vitals_measurements_lcp_good": 40.0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "count_web_vitals_measurements_lcp_good", "type": "Float64"},
            ],
        )

    def test_run_query_with_on_demand_epm(self):
        """Test events per minute for 1 event within an hour."""
        field = "epm()"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)
        timestamp = self.start
        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash},
            timestamp=timestamp,
        )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:1] == [{"time": timestamp.isoformat(), "epm": 1 / 60}]
        assert result["meta"] == [
            {"name": "time", "type": "DateTime('Universal')"},
            {"name": "epm", "type": "Float64"},
        ]

    def test_run_query_with_on_demand_eps(self):
        """Test event per second for 1 event within an hour."""
        field = "eps()"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)
        timestamp = self.start
        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash},
            timestamp=timestamp,
        )
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_s,
            selected_columns=[field],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY
            ),
        )
        result = query.run_query("test_query")
        assert result["data"][:1] == [{"time": timestamp.isoformat(), "eps": 1 / 60 / 60}]
        assert result["meta"] == [
            {"name": "time", "type": "DateTime('Universal')"},
            {"name": "eps", "type": "Float64"},
        ]

    def test_run_top_timeseries_query_with_on_demand_columns(self):
        field = "count()"
        field_two = "count_web_vitals(measurements.lcp, good)"
        groupbys = ["customtag1", "customtag2"]
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, groupbys=groupbys, query=query_s)
        spec_two = OnDemandMetricSpec(field=field_two, groupbys=groupbys, query=query_s)

        for day in range(0, 5):
            self.store_on_demand_metric(
                day * 62 * 24,
                spec=spec,
                additional_tags={
                    "customtag1": "div > text",  # Spec tags for fields need to be overriden since the stored value is dynamic
                    "customtag2": "red",
                },
                timestamp=self.start + datetime.timedelta(days=day),
            )
            self.store_on_demand_metric(
                day * 60 * 24,
                spec=spec_two,
                additional_tags={
                    "customtag1": "div > text",  # Spec tags for fields need to be overriden since the stored value is dynamic
                    "customtag2": "red",
                },
                timestamp=self.start + datetime.timedelta(days=day),
            )

        query = TopMetricsQueryBuilder(
            Dataset.PerformanceMetrics,
            self.params,
            3600 * 24,
            [{"customtag1": "div > text"}, {"customtag2": "red"}],
            query=query_s,
            selected_columns=groupbys,
            timeseries_columns=[field, field_two],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
            ),
        )
        assert query._on_demand_metric_spec_map[field]
        assert query._on_demand_metric_spec_map[field_two]

        mep_query = TopMetricsQueryBuilder(
            Dataset.PerformanceMetrics,
            self.params,
            3600 * 24,
            [{"customtag1": "div > text"}, {"customtag2": "red"}],
            query="",
            selected_columns=groupbys,
            timeseries_columns=[field, field_two],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=False,
            ),
        )

        assert not mep_query._on_demand_metric_spec_map
        result = query.run_query("test_query")

        assert result["data"]

        assert result["data"][:3] == [
            {
                "time": (self.start + datetime.timedelta(days=0, hours=-10)).isoformat(),
                "count": 0.0,
                "count_web_vitals_measurements_lcp_good": 0.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=1, hours=-10)).isoformat(),
                "count": 1488.0,
                "count_web_vitals_measurements_lcp_good": 1440.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=2, hours=-10)).isoformat(),
                "count": 2976.0,
                "count_web_vitals_measurements_lcp_good": 2880.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
        ]

        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "count", "type": "Float64"},
                {"name": "count_web_vitals_measurements_lcp_good", "type": "Float64"},
                {"name": "customtag1", "type": "string"},
                {"name": "customtag2", "type": "string"},
            ],
        )

    def test_on_demand_top_timeseries_simple_metric_spec_with_environment_set(self):
        field = "count()"
        groupbys = ["customtag1", "customtag2"]
        query_s = "transaction.duration:>=100"
        self.create_environment(project=self.project, name="prod")
        self.create_environment(project=self.project, name="dev")

        spec = OnDemandMetricSpec(
            field=field,
            groupbys=groupbys,
            query=query_s,
            environment="prod",
            spec_type=MetricSpecType.SIMPLE_QUERY,
        )

        for day in range(0, 5):
            self.store_on_demand_metric(
                day * 62 * 24,
                spec=spec,
                additional_tags={
                    "customtag1": "div > text",  # Spec tags for fields need to be overriden since the stored value is dynamic
                    "customtag2": "red",
                },
                timestamp=self.start + datetime.timedelta(days=day),
            )

        params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
            "environment": "dev",
        }

        def create_query_builder(params):
            return TopMetricsQueryBuilder(
                Dataset.PerformanceMetrics,
                params,
                3600 * 24,
                [{"customtag1": "div > text"}, {"customtag2": "red"}],
                query=query_s,
                selected_columns=groupbys,
                timeseries_columns=[field],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                ),
            )

        query_builder = create_query_builder(params)

        assert query_builder._on_demand_metric_spec_map[field]
        spec_from_query = query_builder._on_demand_metric_spec_map[field]
        assert spec_from_query.spec_type == MetricSpecType.SIMPLE_QUERY
        assert (
            spec_from_query._query_str_for_hash
            == "None;{'inner': [{'op': 'eq', 'name': 'event.environment', 'value': 'dev'}, {'op': 'gte', 'name': 'event.duration', 'value': 100.0}], 'op': 'and'};['customtag1', 'customtag2']"
        )

        empty_result = query_builder.run_query("test_query")
        assert empty_result["data"] == []

        params["environment"] = "prod"
        query_builder = create_query_builder(params)

        # Asserting hash remains the same
        assert query_builder._on_demand_metric_spec_map[field]
        spec_from_query = query_builder._on_demand_metric_spec_map[field]
        assert spec_from_query.spec_type == MetricSpecType.SIMPLE_QUERY
        assert (
            spec_from_query._query_str_for_hash
            == "None;{'inner': [{'op': 'eq', 'name': 'event.environment', 'value': 'prod'}, {'op': 'gte', 'name': 'event.duration', 'value': 100.0}], 'op': 'and'};['customtag1', 'customtag2']"
        )

        result = query_builder.run_query("correct_query")

        assert result["data"]

        assert result["data"][:3] == [
            {
                "time": (self.start + datetime.timedelta(days=0, hours=-10)).isoformat(),
                "count": 0.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=1, hours=-10)).isoformat(),
                "count": 1488.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=2, hours=-10)).isoformat(),
                "count": 2976.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
        ]

        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "count", "type": "Float64"},
                {"name": "customtag1", "type": "string"},
                {"name": "customtag2", "type": "string"},
            ],
        )

    def test_on_demand_top_timeseries_dynamic_metric_spec_with_environment_set(self):
        field = "count()"
        groupbys = ["customtag1", "customtag2"]
        query_s = "transaction.duration:>=100"
        self.create_environment(project=self.project, name="prod")
        self.create_environment(project=self.project, name="dev")

        spec = OnDemandMetricSpec(
            field=field,
            groupbys=groupbys,
            query=query_s,
            environment="prod",
            spec_type=MetricSpecType.DYNAMIC_QUERY,
        )

        for day in range(0, 5):
            self.store_on_demand_metric(
                day * 62 * 24,
                spec=spec,
                additional_tags={
                    "customtag1": "div > text",  # Spec tags for fields need to be overriden since the stored value is dynamic
                    "customtag2": "red",
                    "environment": "prod",
                },
                timestamp=self.start + datetime.timedelta(days=day),
            )

        params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
            "environment": "dev",
        }

        def create_query_builder(params):
            return TopMetricsQueryBuilder(
                Dataset.PerformanceMetrics,
                params,
                3600 * 24,
                [{"customtag1": "div > text"}, {"customtag2": "red"}],
                query=query_s,
                selected_columns=groupbys,
                timeseries_columns=[field],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY,
                ),
            )

        query_builder = create_query_builder(params)

        assert query_builder._on_demand_metric_spec_map[field]
        spec_from_query = query_builder._on_demand_metric_spec_map[field]
        assert spec_from_query.spec_type == MetricSpecType.DYNAMIC_QUERY
        assert (
            spec_from_query._query_str_for_hash
            == "None;{'name': 'event.duration', 'op': 'gte', 'value': 100.0};['customtag1', 'customtag2']"
        )

        empty_result = query_builder.run_query("test_query")
        assert empty_result["data"] == []

        params["environment"] = "prod"
        query_builder = create_query_builder(params)

        # Asserting hash remains the same
        assert query_builder._on_demand_metric_spec_map[field]
        spec_from_query = query_builder._on_demand_metric_spec_map[field]
        assert spec_from_query.spec_type == MetricSpecType.DYNAMIC_QUERY
        assert (
            spec_from_query._query_str_for_hash
            == "None;{'name': 'event.duration', 'op': 'gte', 'value': 100.0};['customtag1', 'customtag2']"
        )

        result = query_builder.run_query("correct_query")

        assert result["data"]

        assert result["data"][:3] == [
            {
                "time": (self.start + datetime.timedelta(days=0, hours=-10)).isoformat(),
                "count": 0.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=1, hours=-10)).isoformat(),
                "count": 1488.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
            {
                "time": (self.start + datetime.timedelta(days=2, hours=-10)).isoformat(),
                "count": 2976.0,
                "customtag1": "div > text",
                "customtag2": "red",
            },
        ]

        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "count", "type": "Float64"},
                {"name": "customtag1", "type": "string"},
                {"name": "customtag2", "type": "string"},
            ],
        )

    def test_on_demand_map_with_multiple_selected(self):
        query_str = "transaction.duration:>=100"
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_str,
            selected_columns=["eps()", "epm()", "not_on_demand"],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY
            ),
        )
        assert query._on_demand_metric_spec_map
        assert query._on_demand_metric_spec_map["eps()"]
        assert query._on_demand_metric_spec_map["epm()"]
        assert "not_on_demand" not in query._on_demand_metric_spec_map

    def test_on_demand_map_with_multiple_percentiles(self):
        field = "p75(measurements.fcp)"
        field_two = "p75(measurements.lcp)"
        query_str = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(
            field=field, query=query_str, spec_type=MetricSpecType.DYNAMIC_QUERY
        )
        spec_two = OnDemandMetricSpec(
            field=field_two, query=query_str, spec_type=MetricSpecType.DYNAMIC_QUERY
        )

        for day in range(0, 4):
            self.store_on_demand_metric(
                day * 250,
                spec=spec,
                timestamp=self.start + datetime.timedelta(days=0),
            )
            self.store_on_demand_metric(
                day * 500,
                spec=spec_two,
                timestamp=self.start + datetime.timedelta(days=0),
            )

        query_str = "transaction.duration:>=100"
        query = TimeseriesMetricQueryBuilder(
            self.params,
            dataset=Dataset.PerformanceMetrics,
            interval=3600,
            query=query_str,
            selected_columns=["p75(measurements.fcp)", "p75(measurements.lcp)"],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True, on_demand_metrics_type=MetricSpecType.DYNAMIC_QUERY
            ),
        )
        assert query._on_demand_metric_spec_map
        assert query._on_demand_metric_spec_map["p75(measurements.fcp)"]
        assert query._on_demand_metric_spec_map["p75(measurements.lcp)"]

        result = query.run_query("test_query")
        assert result["data"][:1] == [
            {
                "time": self.start.isoformat(),
                "p75_measurements_fcp": 562.5,
                "p75_measurements_lcp": 1125.0,
            },
        ]

    def _test_user_misery(
        self, user_to_frustration: list[tuple[str, bool]], expected_user_misery: float
    ) -> None:
        threshold = 300
        field = f"user_misery({threshold})"
        query_s = "transaction.duration:>=10"
        # You can only query this function if you have the feature flag for the org
        spec_type = MetricSpecType.SIMPLE_QUERY
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=spec_type)

        for hour in range(0, 2):
            for name, frustrated in user_to_frustration:
                tags = (
                    {"query_hash": spec.query_hash, "satisfaction": "frustrated"}
                    if frustrated
                    else {"query_hash": spec.query_hash}
                )
                self.store_transaction_metric(
                    value=name,
                    metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                    # It's a set on demand because of using the users field
                    internal_metric=TransactionMRI.SET_ON_DEMAND.value,
                    entity=EntityKey.MetricsSets.value,
                    tags=tags,
                    timestamp=self.start + datetime.timedelta(hours=hour),
                )

        def create_query_builder():
            return TimeseriesMetricQueryBuilder(
                self.params,
                dataset=Dataset.PerformanceMetrics,
                interval=3600,
                query=query_s,
                selected_columns=[field],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True, on_demand_metrics_type=spec_type
                ),
            )

        with Feature({SPEC_VERSION_TWO_FLAG: False}):
            # user_misery was added in spec version 2, querying without it results in fallback.
            with pytest.raises(IncompatibleMetricsQuery):
                create_query_builder()

        with Feature(SPEC_VERSION_TWO_FLAG):
            query = create_query_builder()
            assert query._on_demand_metric_spec_map
            selected_spec = query._on_demand_metric_spec_map[field]
            metrics_query = query._get_metrics_query_from_on_demand_spec(
                spec=selected_spec, require_time_range=True
            )

            assert len(metrics_query.select) == 1
            assert metrics_query.select[0].op == "on_demand_user_misery"
            assert metrics_query.where
            assert metrics_query.where[0].lhs.name == "query_hash"
            # hashed "on_demand_user_misery:300;{'name': 'event.duration', 'op': 'gte', 'value': 10.0}"
            assert metrics_query.where[0].rhs == "f9a20ff3"
            assert metrics_query.where[0].rhs == spec.query_hash

        result = query.run_query("test_query")
        assert result["data"][:3] == [
            {
                "time": self.start.isoformat(),
                "user_misery_300": expected_user_misery,
            },
            {
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
                "user_misery_300": expected_user_misery,
            },
            {
                "time": (self.start + datetime.timedelta(hours=2)).isoformat(),
                "user_misery_300": 0,
            },
        ]
        self.assertCountEqual(
            result["meta"],
            [
                {"name": "time", "type": "DateTime('Universal')"},
                {"name": "user_misery_300", "type": "Float64"},
            ],
        )

    def test_run_query_with_on_demand_user_misery(self) -> None:
        self._test_user_misery(
            [("happy user", False), ("sad user", True)],
            user_misery_formula(1, 2),
        )

    def test_run_query_with_on_demand_user_misery_no_miserable_users(self) -> None:
        self._test_user_misery(
            [("happy user", False), ("ok user", False)],
            user_misery_formula(0, 2),
        )


class HistogramMetricQueryBuilderTest(MetricBuilderBaseTest):
    def test_histogram_columns_set_on_builder(self):
        builder = HistogramMetricQueryBuilder(
            params=self.params,
            dataset=Dataset.PerformanceMetrics,
            query="",
            selected_columns=[
                "histogram(transaction.duration)",
                "histogram(measurements.lcp)",
                "histogram(measurements.fcp) as test",
            ],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        self.assertCountEqual(
            builder.histogram_aliases,
            [
                "histogram_transaction_duration",
                "histogram_measurements_lcp",
                "test",
            ],
        )

    def test_get_query(self):
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
            aggregation_option=AggregationOption.HIST,
        )
        self.store_transaction_metric(
            100,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
            aggregation_option=AggregationOption.HIST,
        )
        self.store_transaction_metric(
            450,
            tags={"transaction": "foo_transaction"},
            timestamp=self.start + datetime.timedelta(minutes=5),
            aggregation_option=AggregationOption.HIST,
        )

        query = HistogramMetricQueryBuilder(
            params=self.params,
            dataset=Dataset.PerformanceMetrics,
            query="",
            selected_columns=["histogram(transaction.duration)"],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        snql_query = query.run_query("test_query")
        assert len(snql_query["data"]) == 1
        # This data is intepolated via rebucket_histogram
        assert snql_query["data"][0]["histogram_transaction_duration"] == [
            (0.0, 100.0, 0),
            (100.0, 200.0, 2),
            (200.0, 300.0, 1),
            (300.0, 400.0, 1),
            (400.0, 500.0, 1),
        ]

    def test_query_normal_distribution(self):
        for i in range(5):
            for _ in range((5 - abs(i - 2)) ** 2):
                self.store_transaction_metric(
                    100 * i + 50,
                    tags={"transaction": "foo_transaction"},
                    timestamp=self.start + datetime.timedelta(minutes=5),
                    aggregation_option=AggregationOption.HIST,
                )

        query = HistogramMetricQueryBuilder(
            params=self.params,
            query="",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["histogram(transaction.duration)"],
            histogram_params=HistogramParams(
                5,
                100,
                0,
                1,  # not used by Metrics
            ),
        )
        snql_query = query.run_query("test_query")
        assert len(snql_query["data"]) == 1
        # This data is intepolated via rebucket_histogram
        assert snql_query["data"][0]["histogram_transaction_duration"] == [
            (0.0, 100.0, 10),
            (100.0, 200.0, 17),
            (200.0, 300.0, 23),
            (300.0, 400.0, 17),
            (400.0, 500.0, 10),
        ]


class AlertMetricsQueryBuilderTest(MetricBuilderBaseTest):
    def test_run_query_with_on_demand_distribution(self):
        field = "p75(measurements.fp)"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        self.store_transaction_metric(
            value=200,
            metric=TransactionMetricKey.DIST_ON_DEMAND.value,
            internal_metric=TransactionMRI.DIST_ON_DEMAND.value,
            entity="metrics_distributions",
            tags={"query_hash": spec.query_hash},
            timestamp=self.start,
        )

        query = AlertMetricsQueryBuilder(
            self.params,
            granularity=3600,
            time_range_window=3600,
            query=query_s,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[field],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                skip_time_conditions=False,
            ),
        )

        result = query.run_query("test_query")

        assert result["data"] == [{"d:transactions/on_demand@none": 200.0}]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "d:transactions/on_demand@none"

    def test_run_query_with_on_demand_count_and_environments(self):
        field = "count(measurements.fp)"
        query_s = "transaction.duration:>=100"

        self.create_environment(project=self.project, name="prod")

        # We want to test also with "dev" that is not in the database, to check that we fallback to avoiding the
        # environment filter at all.
        environments = ((None, 100), ("prod", 200), ("dev", 300))
        specs = []
        for environment, value in environments:
            spec = OnDemandMetricSpec(
                field=field,
                query=query_s,
                environment=environment,
                spec_type=MetricSpecType.SIMPLE_QUERY,
            )
            self.store_transaction_metric(
                value=value,
                metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
                internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
                entity="metrics_counters",
                tags={"query_hash": spec.query_hash},
                timestamp=self.start,
            )
            specs.append(spec)

        expected_environments = ((None, 100), ("prod", 200), ("dev", 100))
        for (environment, value), spec in zip(expected_environments, specs):
            params = (
                self.params
                if environment is None
                else {**self.params, "environment": [environment]}
            )
            query = AlertMetricsQueryBuilder(
                params,
                granularity=3600,
                time_range_window=3600,
                query=query_s,
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[field],
                config=QueryBuilderConfig(
                    use_metrics_layer=False,
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                    skip_time_conditions=False,
                ),
            )
            assert query._on_demand_metric_spec_map == {
                "count(measurements.fp)": OnDemandMetricSpec(
                    field=field,
                    query=query_s,
                    environment=environment,
                    spec_type=MetricSpecType.SIMPLE_QUERY,
                )
            }

            result = query.run_query("test_query")

            assert result["data"] == [{"c:transactions/on_demand@none": float(value)}]
            meta = result["meta"]
            assert len(meta) == 1
            assert meta[0]["name"] == "c:transactions/on_demand@none"

    def test_run_query_with_on_demand_failure_rate(self):
        field = "failure_rate()"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash, "failure": "true"},
            timestamp=self.start,
        )

        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash},
            timestamp=self.start,
        )

        query = AlertMetricsQueryBuilder(
            self.params,
            granularity=3600,
            time_range_window=3600,
            query=query_s,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[field],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                skip_time_conditions=False,
            ),
        )

        result = query.run_query("test_query")

        # (1 failure / 2 total) = 0.5
        assert result["data"] == [{"c:transactions/on_demand@none": 0.5}]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "c:transactions/on_demand@none"

    def test_run_query_with_on_demand_apdex(self):
        field = "apdex(10)"
        query_s = "transaction.duration:>=100"
        spec = OnDemandMetricSpec(field=field, query=query_s, spec_type=MetricSpecType.SIMPLE_QUERY)

        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash, "satisfaction": "satisfactory"},
            timestamp=self.start,
        )

        self.store_transaction_metric(
            value=1,
            metric=TransactionMetricKey.COUNT_ON_DEMAND.value,
            internal_metric=TransactionMRI.COUNT_ON_DEMAND.value,
            entity="metrics_counters",
            tags={"query_hash": spec.query_hash, "satisfaction": "tolerable"},
            timestamp=self.start,
        )

        query = AlertMetricsQueryBuilder(
            self.params,
            granularity=3600,
            time_range_window=3600,
            query=query_s,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[field],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                skip_time_conditions=False,
            ),
        )

        result = query.run_query("test_query")

        # (1 satisfactory + (1 tolerable / 2)) / (2 total) = 0.75
        assert result["data"] == [{"c:transactions/on_demand@none": 0.75}]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "c:transactions/on_demand@none"

    def test_run_query_with_on_demand_count_and_time_range_required_and_not_supplied(self):
        params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
        }

        query = AlertMetricsQueryBuilder(
            params,
            granularity=3600,
            time_range_window=3600,
            query="transaction.duration:>=100",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["count(transaction.duration)"],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                # We set here the skipping of conditions, since this is true for alert subscriptions, but we want to verify
                # whether our secondary error barrier works.
                skip_time_conditions=True,
            ),
        )

        with pytest.raises(IncompatibleMetricsQuery):
            query.run_query("test_query")

    def test_get_snql_query_with_on_demand_distribution_and_time_range_not_required_and_not_supplied(
        self,
    ):
        params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
        }
        query = AlertMetricsQueryBuilder(
            params,
            granularity=3600,
            time_range_window=3600,
            query="transaction.duration:>=100",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["p75(measurements.fp)"],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                # We want to test the snql generation when a time range is not supplied, which is the case for alert
                # subscriptions.
                skip_time_conditions=True,
            ),
        )

        snql_request = query.get_snql_query()
        assert snql_request.dataset == "generic_metrics"
        snql_query = snql_request.query
        self.assertCountEqual(
            [
                Function(
                    "arrayElement",
                    [
                        Function(
                            "quantilesIf(0.75)",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        indexer.resolve(
                                            UseCaseID.TRANSACTIONS,
                                            1,
                                            "d:transactions/on_demand@none",
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        1,
                    ],
                    "d:transactions/on_demand@none",
                )
            ],
            snql_query.select,
        )

        query_hash_index = indexer.resolve(UseCaseID.TRANSACTIONS, 1, QUERY_HASH_KEY)

        query_hash_clause = Condition(
            lhs=Column(name=f"tags_raw[{query_hash_index}]"), op=Op.EQ, rhs="62b395db"
        )

        assert query_hash_clause in snql_query.where

    def test_get_snql_query_with_on_demand_count_and_time_range_required_and_supplied(self):
        query = AlertMetricsQueryBuilder(
            self.params,
            granularity=3600,
            time_range_window=3600,
            query="transaction.duration:>=100",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["count(transaction.duration)"],
            config=QueryBuilderConfig(
                use_metrics_layer=False,
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                # We want to test the snql generation when a time range is supplied.
                skip_time_conditions=False,
            ),
        )

        snql_request = query.get_snql_query()
        assert snql_request.dataset == "generic_metrics"
        snql_query = snql_request.query
        self.assertCountEqual(
            [
                Function(
                    "sumIf",
                    [
                        Column("value"),
                        Function(
                            "equals",
                            [
                                Column("metric_id"),
                                indexer.resolve(
                                    UseCaseID.TRANSACTIONS,
                                    1,
                                    "c:transactions/on_demand@none",
                                ),
                            ],
                        ),
                    ],
                    "c:transactions/on_demand@none",
                )
            ],
            snql_query.select,
        )

        query_hash_index = indexer.resolve(UseCaseID.TRANSACTIONS, 1, QUERY_HASH_KEY)

        start_time_clause = Condition(lhs=Column(name="timestamp"), op=Op.GTE, rhs=self.start)
        end_time_clause = Condition(lhs=Column(name="timestamp"), op=Op.LT, rhs=self.end)
        query_hash_clause = Condition(
            lhs=Column(name=f"tags_raw[{query_hash_index}]"), op=Op.EQ, rhs="88f3eb66"
        )

        assert start_time_clause in snql_query.where
        assert end_time_clause in snql_query.where
        assert query_hash_clause in snql_query.where

    def test_run_query_with_spm_and_time_range_not_required_and_not_supplied(self):
        params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
        }
        query = AlertMetricsQueryBuilder(
            params,
            granularity=60,
            time_range_window=3600,
            query="span.module:db",
            dataset=Dataset.PerformanceMetrics,
            selected_columns=["spm()"],
            offset=None,
            config=QueryBuilderConfig(
                skip_time_conditions=True,
                use_metrics_layer=True,
                insights_metrics_override_metric_layer=True,
            ),
        )

        snql_request = query.get_snql_query()
        assert snql_request.dataset == "generic_metrics"
        snql_query = snql_request.query

        self.assertCountEqual(
            [
                Function(
                    "divide",
                    [
                        Function(
                            "countIf",
                            [
                                Column("value"),
                                Function(
                                    "equals",
                                    [
                                        Column("metric_id"),
                                        indexer.resolve(
                                            UseCaseID.SPANS,
                                            1,
                                            "d:spans/exclusive_time@millisecond",
                                        ),
                                    ],
                                ),
                            ],
                        ),
                        Function("divide", [3600, 60]),
                    ],
                    "spm",
                )
            ],
            snql_query.select,
        )


class CustomMetricsWithMetricsLayerTest(MetricBuilderBaseTest):
    def setUp(self):
        super().setUp()

    def test_count_metrics_query(self):
        mri = "c:custom/website_click@none"
        aggregate = f"sum({mri})"

        for index, value in enumerate((10, 20)):
            self.store_transaction_metric(
                value=value,
                metric=mri,
                internal_metric=mri,
                entity="metrics_counters",
                tags={},
                timestamp=self.start + datetime.timedelta(hours=index),
                use_case_id=UseCaseID.CUSTOM,
            )

        series_query = TimeseriesMetricQueryBuilder(
            self.params,
            interval=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                use_metrics_layer=True,
            ),
        )

        result = series_query.run_query("test_query")
        assert result["data"][:2] == [
            {
                "sum_c_custom_website_click_none": 10.0,
                "time": (self.start + datetime.timedelta(hours=0)).isoformat(),
            },
            {
                "sum_c_custom_website_click_none": 20.0,
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
            },
        ]
        meta = result["meta"]
        assert len(meta) == 2
        assert meta[1]["name"] == "sum_c_custom_website_click_none"

        totals_query = MetricsQueryBuilder(
            self.params,
            granularity=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                use_metrics_layer=True,
            ),
        )
        result = totals_query.run_query("test_query")
        assert result["data"] == [{"sum_c_custom_website_click_none": 30.0}]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "sum_c_custom_website_click_none"

    def test_distribution_metrics_query(self):
        mri = "d:custom/sentry.process_profile.track_outcome@second"
        aggregate = f"sum({mri})"

        for index, (value, phone) in enumerate(((10, "iPhone"), (20, "OnePlus"))):
            for multiplier in (1, 2, 3):
                self.store_transaction_metric(
                    value=value * multiplier,
                    metric=mri,
                    internal_metric=mri,
                    entity="metrics_distributions",
                    tags={"phone": phone},
                    timestamp=self.start + datetime.timedelta(hours=index),
                    use_case_id=UseCaseID.CUSTOM,
                )

        series_query = TimeseriesMetricQueryBuilder(
            self.params,
            interval=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            query="phone:iPhone OR phone:OnePlus",
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                use_metrics_layer=True,
            ),
        )

        result = series_query.run_query("test_query")
        assert result["data"][:2] == [
            {
                "sum_d_custom_sentry_process_profile_track_outcome_second": 60.0,
                "time": (self.start + datetime.timedelta(hours=0)).isoformat(),
            },
            {
                "sum_d_custom_sentry_process_profile_track_outcome_second": 120.0,
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
            },
        ]
        meta = result["meta"]
        assert len(meta) == 2
        assert meta[1]["name"] == "sum_d_custom_sentry_process_profile_track_outcome_second"

        totals_query = MetricsQueryBuilder(
            self.params,
            granularity=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            query="phone:iPhone OR phone:OnePlus",
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                use_metrics_layer=True,
            ),
        )
        result = totals_query.run_query("test_query")
        assert result["data"] == [
            {"sum_d_custom_sentry_process_profile_track_outcome_second": 180.0}
        ]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "sum_d_custom_sentry_process_profile_track_outcome_second"

    def test_set_metrics_query(self):
        mri = "s:custom/user_click@none"
        aggregate = f"count_unique({mri})"

        for index, (user, country) in enumerate((("Marco", "IT"), ("Andrea", "DE"))):
            # We store the same value two times to check for uniqueness in the result.
            for i in range(0, 2):
                self.store_transaction_metric(
                    value=user,
                    metric=mri,
                    internal_metric=mri,
                    entity="metrics_sets",
                    tags={"country": country},
                    timestamp=self.start + datetime.timedelta(hours=index),
                    use_case_id=UseCaseID.CUSTOM,
                )

        series_query = TimeseriesMetricQueryBuilder(
            self.params,
            interval=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            query="country:IT",
            config=QueryBuilderConfig(
                on_demand_metrics_enabled=True,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                use_metrics_layer=True,
            ),
        )
        result = series_query.run_query("test_query")
        assert result["data"][:2] == [
            {
                "count_unique_s_custom_user_click_none": 1,
                "time": (self.start + datetime.timedelta(hours=0)).isoformat(),
            },
            {
                "count_unique_s_custom_user_click_none": 0,
                "time": (self.start + datetime.timedelta(hours=1)).isoformat(),
            },
        ]
        meta = result["meta"]
        assert len(meta) == 2
        assert meta[1]["name"] == "count_unique_s_custom_user_click_none"

        totals_query = MetricsQueryBuilder(
            self.params,
            granularity=3600,
            dataset=Dataset.PerformanceMetrics,
            selected_columns=[aggregate],
            query="country:IT",
            config=QueryBuilderConfig(
                use_metrics_layer=True,
            ),
        )
        result = totals_query.run_query("test_query")
        assert result["data"] == [{"count_unique_s_custom_user_click_none": 1}]
        meta = result["meta"]
        assert len(meta) == 1
        assert meta[0]["name"] == "count_unique_s_custom_user_click_none"

    def test_custom_metric_query_generation(self):
        indexer.record(use_case_id=UseCaseID.CUSTOM, org_id=self.organization.id, string="phone")

        for aggregate, expected_aggregate, mri, expected_alias in (
            ("sum", "sumIf", "c:custom/user.click@none", "sum_c_custom_user_click_none"),
            (
                "max",
                "maxIf",
                "d:custom/sentry.process_profile.track_outcome@second",
                "max_d_custom_sentry_process_profile_track_outcome_second",
            ),
            ("count_unique", "uniqIf", "s:custom/user@none", "count_unique_s_custom_user_none"),
        ):
            indexer.record(use_case_id=UseCaseID.CUSTOM, org_id=self.organization.id, string=mri)

            query = AlertMetricsQueryBuilder(
                {**self.params, "environment": self.environment.name},
                granularity=3600,
                time_range_window=3600,
                query="phone:iPhone",
                dataset=Dataset.PerformanceMetrics,
                selected_columns=[f"{aggregate}({mri})"],
                config=QueryBuilderConfig(
                    on_demand_metrics_enabled=True,
                    on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                    # We want to replicate the condition for the alerts in production, which has to coexist
                    # with on demand metrics.
                    skip_time_conditions=True,
                    use_metrics_layer=True,
                ),
            )

            snql_request = query.get_snql_query()
            assert snql_request.dataset == "generic_metrics"

            snql_query = snql_request.query
            self.assertCountEqual(
                [
                    Function(
                        expected_aggregate,
                        [
                            Column("value"),
                            Function(
                                "equals",
                                [
                                    Column("metric_id"),
                                    indexer.resolve(
                                        UseCaseID.CUSTOM,
                                        self.organization.id,
                                        mri,
                                    ),
                                ],
                            ),
                        ],
                        expected_alias,
                    )
                ],
                snql_query.select,
            )

            for expected_tag_key, expected_tag_value in (
                ("environment", "development"),
                ("phone", "iPhone"),
            ):
                tag_key_indexed = indexer.resolve(
                    UseCaseID.CUSTOM, self.organization.id, expected_tag_key
                )
                tag_condition = Condition(
                    lhs=Column(name=f"tags_raw[{tag_key_indexed}]"),
                    op=Op.EQ,
                    rhs=expected_tag_value,
                )
                assert tag_condition in snql_query.where
