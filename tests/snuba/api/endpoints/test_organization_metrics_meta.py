import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = [
    pytest.mark.sentry_metrics,
    pytest.mark.skip(
        reason="Generic metrics sets, gauges, and distributions are no longer queryable"
    ),
]


class OrganizationMetricsCompatiblity(MetricsEnhancedPerformanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.features: dict[str, bool] = {}
        self.login_as(user=self.user)
        # Extra project so the org has more than one project id to report.
        self.other_project = self.create_project()

    def test_always_reports_projects_as_incompatible(self) -> None:
        # Stored metrics should not matter; generic metrics queries are disabled.
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.json()["incompatible_projects"],
            [self.project.id, self.other_project.id],
        )
        assert response.json()["compatible_projects"] == []

    def test_no_projects(self) -> None:
        org = self.create_organization()
        self.create_member(user=self.user, organization=org, role="member")
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": org.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["incompatible_projects"] == []
        assert response.json()["compatible_projects"] == []


class OrganizationEventsMetricsSums(MetricsEnhancedPerformanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.features: dict[str, bool] = {}
        self.login_as(user=self.user)
        self.create_project()

    def test_always_reports_empty_metrics_sums(self) -> None:
        # Stored metrics should not matter; generic metrics queries are disabled.
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        self.store_transaction_metric(
            1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
        )
        self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)

        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 0
        assert response.json()["sum"]["metrics_unparam"] == 0
        assert response.json()["sum"]["metrics_null"] == 0
