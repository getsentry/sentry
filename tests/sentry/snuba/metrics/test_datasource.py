import time
from datetime import timedelta
from unittest import mock

import pytest
from django.utils.datastructures import MultiValueDict

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.datasource import get_custom_measurements, get_series
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import BaseMetricsTestCase, TestCase
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class DataSourceTestCase(TestCase, BaseMetricsTestCase):
    def test_valid_filter_include_meta(self):
        self.create_release(version="foo", project=self.project)
        self.store_session(
            self.build_session(
                project_id=self.project.id, started=(time.time() // 60), release="foo"
            )
        )

        query_params = MultiValueDict(
            {
                "query": [
                    "release:staging"
                ],  # weird release but we need a string existing in mock indexer
                "groupBy": ["environment", "release"],
                "field": [
                    "sum(sentry.sessions.session)",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        data = get_series(
            [self.project],
            query.to_metrics_query(),
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )
        assert data["meta"] == sorted(
            [
                {"name": "environment", "type": "string"},
                {"name": "release", "type": "string"},
                {"name": "sum(sentry.sessions.session)", "type": "Float64"},
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_valid_filter_include_meta_for_transactions_derived_metrics(self):
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

    def test_validate_include_meta_only_non_composite_derived_metrics_and_in_select(self):
        query_params = MultiValueDict(
            {
                "field": [
                    "session.errored",
                    "session.healthy",
                ],
                "includeSeries": "0",
            }
        )
        query = QueryDefinition([self.project], query_params)
        assert (
            get_series(
                [self.project],
                query.to_metrics_query(),
                include_meta=True,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )["meta"]
            == []
        )


class GetCustomMeasurementsTest(MetricsEnhancedPerformanceTestCase):
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
