import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsStatsProfileFunctionsMetricsEndpointTest(
    MetricsEnhancedPerformanceTestCase
):
    viewname = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.three_days_ago = before_now(days=3)
        self.features = {}

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_basic(self):
        self.store_profile_functions_metric(
            1,
            timestamp=self.three_days_ago,
        )

        query = {
            "dataset": "profileFunctionsMetrics",
            "statsPeriod": "7d",
            "yAxis": ["count()", "p95(function.duration)"],
            "interval": "1d",
            "excludeOther": 1,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
