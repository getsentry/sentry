import pytest
from django.urls import reverse

from sentry.testutils import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsMetricsCompatiblity(MetricsEnhancedPerformanceTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.features = {
            "organizations:performance-use-metrics": True,
        }
        self.login_as(user=self.user)
        self.project.update_option("sentry:dynamic_sampling", "something-it-doesn't-matter")
        # Don't create any txn on this, don't set its DS rules, it shouldn't show up anywhere
        self.create_project()

    def test_has_transaction(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-events-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["compatible_projects"] == [self.project.id]
        assert response.data["dynamic_sampling_projects"] == [self.project.id]
        assert response.data["sum"]["metrics"] == 1
        assert response.data["sum"]["metrics_unparam"] == 0
        assert response.data["sum"]["metrics_null"] == 0
