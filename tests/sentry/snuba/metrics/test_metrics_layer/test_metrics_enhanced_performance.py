"""
Metrics Service Layer Tests for Performance
"""
import time
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
from snuba_sdk import Direction, Granularity, Limit, Offset

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import (
    MetricField,
    MetricsQuery,
    OrderBy,
    TransactionStatusTagValue,
    TransactionTagsKey,
)
from sentry.snuba.metrics.datasource import get_custom_measurements, get_series
from sentry.snuba.metrics.naming_layer import TransactionMetricKey, TransactionMRI
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import BaseMetricsTestCase, TestCase
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class PerformanceMetricsLayerTestCase(TestCase, BaseMetricsTestCase):
    def test_valid_filter_include_meta_derived_metrics(self):
        query_params = MultiValueDict(
            {
                "field": [
                    "transaction.user_misery",
                    "transaction.apdex",
                    "transaction.failure_rate",
                    "transaction.failure_count",
                    "transaction.miserable_user",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        data = get_series(
            [self.project],
            query.to_metrics_query(),
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert data["meta"] == sorted(
            [
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
                {"name": "transaction.apdex", "type": "Float64"},
                {"name": "transaction.failure_count", "type": "UInt64"},
                {"name": "transaction.failure_rate", "type": "Float64"},
                {"name": "transaction.miserable_user", "type": "UInt64"},
                {"name": "transaction.user_misery", "type": "Float64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_alias_on_different_metrics_expression(self):
        now = before_now(minutes=0)

        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for value in [123.4] * count:
                self.store_metric(
                    org_id=self.organization.id,
                    project_id=self.project.id,
                    type="distribution",
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={"transaction": v_transaction, "measurement_rating": "poor"},
                    timestamp=int(time.time()),
                    value=value,
                    use_case_id=UseCaseKey.PERFORMANCE,
                )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="count",
                    metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                    alias="count_lcp",
                ),
                MetricField(
                    op="count",
                    metric_name=TransactionMetricKey.MEASUREMENTS_FCP.value,
                    alias="count_fcp",
                ),
            ],
            start=now - timedelta(hours=1),
            end=now,
            granularity=Granularity(granularity=3600),
            groupby=["transaction"],
            orderby=[
                OrderBy(
                    MetricField(
                        op="count",
                        metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                        alias="count_lcp",
                    ),
                    Direction.DESC,
                ),
                OrderBy(
                    MetricField(
                        op="count",
                        metric_name=TransactionMetricKey.MEASUREMENTS_FCP.value,
                        alias="count_fcp",
                    ),
                    Direction.DESC,
                ),
            ],
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        groups = data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar", 3),
            ("/baz", 2),
        ]
        for (expected_transaction, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert group["by"] == {"transaction": expected_transaction}
            assert group["totals"] == {
                "count_lcp": expected_count,
                "count_fcp": 0,
            }

        assert data["meta"] == sorted(
            [
                {"name": "count_fcp", "type": "UInt64"},
                {"name": "count_lcp", "type": "UInt64"},
                {"name": "transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_alias_on_same_metrics_expression_but_different_aliases(self):
        now = before_now(minutes=0)
        for v_transaction, count in (("/foo", 1), ("/bar", 3), ("/baz", 2)):
            for value in [123.4] * count:
                self.store_metric(
                    org_id=self.organization.id,
                    project_id=self.project.id,
                    type="distribution",
                    name=TransactionMRI.MEASUREMENTS_LCP.value,
                    tags={"transaction": v_transaction, "measurement_rating": "poor"},
                    timestamp=int(time.time()),
                    value=value,
                    use_case_id=UseCaseKey.PERFORMANCE,
                )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="count",
                    metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                    alias="count_lcp",
                ),
                MetricField(
                    op="count",
                    metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                    alias="count_lcp_2",
                ),
            ],
            start=now - timedelta(hours=1),
            end=now,
            granularity=Granularity(granularity=3600),
            groupby=["transaction"],
            orderby=[
                OrderBy(
                    MetricField(
                        op="count",
                        metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                        alias="count_lcp",
                    ),
                    Direction.DESC,
                ),
                OrderBy(
                    MetricField(
                        op="count",
                        metric_name=TransactionMetricKey.MEASUREMENTS_LCP.value,
                        alias="count_lcp_2",
                    ),
                    Direction.DESC,
                ),
            ],
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        groups = data["groups"]
        assert len(groups) == 2

        expected = [
            ("/bar", 3),
            ("/baz", 2),
        ]
        for (expected_transaction, expected_count), group in zip(expected, groups):
            # With orderBy, you only get totals:
            assert group["by"] == {"transaction": expected_transaction}
            assert group["totals"] == {
                "count_lcp": expected_count,
                "count_lcp_2": expected_count,
            }
        assert data["meta"] == sorted(
            [
                {"name": "count_lcp", "type": "UInt64"},
                {"name": "count_lcp_2", "type": "UInt64"},
                {"name": "transaction", "type": "string"},
            ],
            key=lambda elem: elem["name"],
        )

    @freeze_time()
    def test_alias_on_single_entity_derived_metrics(self):
        now = timezone.now()

        for value, tag_value in (
            (3.4, TransactionStatusTagValue.OK.value),
            (0.3, TransactionStatusTagValue.CANCELLED.value),
            (2.3, TransactionStatusTagValue.UNKNOWN.value),
            (0.5, TransactionStatusTagValue.ABORTED.value),
        ):
            self.store_metric(
                org_id=self.organization.id,
                project_id=self.project.id,
                type="distribution",
                name=TransactionMRI.DURATION.value,
                tags={TransactionTagsKey.TRANSACTION_STATUS.value: tag_value},
                timestamp=now.timestamp(),
                value=value,
                use_case_id=UseCaseKey.PERFORMANCE,
            )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op=None,
                    metric_name=TransactionMetricKey.FAILURE_RATE.value,
                    alias="failure_rate_alias",
                ),
            ],
            start=now - timedelta(minutes=1),
            end=now,
            granularity=Granularity(granularity=60),
            limit=Limit(limit=2),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert len(data["groups"]) == 1
        group = data["groups"][0]
        assert group["by"] == {}
        assert group["totals"] == {"failure_rate_alias": 0.25}
        assert data["meta"] == [{"name": "failure_rate_alias", "type": "Float64"}]


class GetCustomMeasurementsTestCase(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
        "d:transactions/measurements.something_else@byte",
    ]

    def setUp(self):
        super().setUp()
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

    def test_simple(self):
        something_custom_metric = "d:transactions/measurements.something_custom@millisecond"
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric=something_custom_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        result = get_custom_measurements(
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            start=self.day_ago,
            use_case_id=UseCaseKey.PERFORMANCE,
        )
        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "generic_distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                ],
                "unit": "millisecond",
                "metric_id": indexer.resolve(
                    UseCaseKey.PERFORMANCE, self.organization.id, something_custom_metric
                ),
            }
        ]

    def test_metric_outside_query_daterange(self):
        something_custom_metric = "d:transactions/measurements.something_custom@millisecond"
        something_else_metric = "d:transactions/measurements.something_else@byte"
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric=something_custom_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        # Shouldn't show up
        self.store_transaction_metric(
            1,
            metric="measurements.something_else",
            internal_metric=something_else_metric,
            entity="metrics_distributions",
            timestamp=self.day_ago - timedelta(days=1, minutes=0),
        )
        result = get_custom_measurements(
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            start=self.day_ago,
            use_case_id=UseCaseKey.PERFORMANCE,
        )

        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "generic_distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                ],
                "unit": "millisecond",
                "metric_id": indexer.resolve(
                    UseCaseKey.PERFORMANCE, self.organization.id, something_custom_metric
                ),
            }
        ]

    @mock.patch("sentry.snuba.metrics.datasource.parse_mri")
    def test_broken_custom_metric(self, mock):
        # Store valid metric
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )

        # mock mri failing to parse the metric
        mock.return_value = None
        result = get_custom_measurements(
            project_ids=[self.project.id], organization_id=self.organization.id, start=self.day_ago
        )
        assert result == []
