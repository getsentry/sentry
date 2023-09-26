from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationMeasurementsMetaEndpoint(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-measurements-meta"
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
    ]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago
        self.url = reverse(
            self.endpoint, kwargs={"organization_slug": self.project.organization.slug}
        )
        self.features = {"organizations:performance-use-metrics": True}

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_simple(self):
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "14d",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "measurements.something_custom": {
                "functions": [
                    "apdex",
                    "avg",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                    "p100",
                    "max",
                    "min",
                    "sum",
                    "percentile",
                    "http_error_count",
                    "http_error_rate",
                ],
                "unit": "millisecond",
            }
        }

    def test_metric_outside_query_daterange(self):
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago - timedelta(days=15, minutes=0),
        )
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "14d",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {}
