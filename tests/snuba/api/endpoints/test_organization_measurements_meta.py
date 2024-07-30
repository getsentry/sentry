from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationMeasurementsMetaEndpoint(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-measurements-meta"
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
    ]
    features = {"organizations:discover-basic": True}

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago
        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.project.organization.slug}
        )
        self.features = {"organizations:performance-use-metrics": True}

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

    def test_measurements_with_numbers_in_name(self):
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.1234567890.abcdef@millisecond",
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
            "measurements.1234567890.abcdef": {
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

    def test_measurements_with_lots_of_periods(self):
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.a.b.c.d.e.f.g@millisecond",
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
            "measurements.a.b.c.d.e.f.g": {
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
