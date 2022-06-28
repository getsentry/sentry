from datetime import timedelta

from django.urls import reverse

from sentry.testutils import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationMeasurementsMetaEndpoint(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-measurements-meta"
    METRIC_STRINGS = [
        "d:custom/measurements.something_custom@millisecond",
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
        self.store_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:custom/measurements.something_custom@millisecond",
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
                ],
            }
        }

    def test_metric_outside_query_daterange(self):
        self.store_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:custom/measurements.something_custom@millisecond",
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
