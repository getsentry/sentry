import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationMetricsCompatiblity(MetricsEnhancedPerformanceTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.features = {
            "organizations:performance-use-metrics": True,
        }
        self.login_as(user=self.user)
        # Don't create any txn on this, don't set its DS rules, it shouldn't show up anywhere
        self.bad_project = self.create_project()

    def test_unparameterized_transactions(self):
        # Make current project incompatible
        self.store_transaction_metric(
            1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.json()["incompatible_projects"], [self.project.id, self.bad_project.id]
        )
        assert response.json()["compatible_projects"] == []

    def test_null_transaction(self):
        # Make current project incompatible
        self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.json()["incompatible_projects"], [self.project.id, self.bad_project.id]
        )
        assert response.json()["compatible_projects"] == []

    def test_no_transaction(self):
        # Make current project incompatible by having nothing
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.json()["incompatible_projects"], [self.project.id, self.bad_project.id]
        )
        assert response.json()["compatible_projects"] == []

    def test_has_transaction(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["incompatible_projects"] == [self.bad_project.id]
        assert response.json()["compatible_projects"] == [self.project.id]

    def test_multiple_projects(self):
        project2 = self.create_project()
        project3 = self.create_project()
        project4 = self.create_project()
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago, project=project4.id
        )
        self.store_transaction_metric(
            1,
            tags={"transaction": "<< unparameterized >>"},
            timestamp=self.min_ago,
            project=project2.id,
        )
        self.store_transaction_metric(
            1,
            tags={},
            timestamp=self.min_ago,
            project=project3.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "transaction": "foo_transaction"},
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.json()["incompatible_projects"],
            [project2.id, project3.id, self.bad_project.id],
        )
        self.assertCountEqual(
            response.json()["compatible_projects"], [self.project.id, project4.id]
        )


class OrganizationEventsMetricsSums(MetricsEnhancedPerformanceTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.features = {
            "organizations:performance-use-metrics": True,
        }
        self.login_as(user=self.user)
        # Don't create any txn on this, don't set its DS rules, it shouldn't show up anywhere
        self.create_project()

    def test_unparameterized_transactions(self):
        # Make current project incompatible
        self.store_transaction_metric(
            1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 1
        assert response.json()["sum"]["metrics_unparam"] == 1
        assert response.json()["sum"]["metrics_null"] == 0

    def test_null_transaction(self):
        # Make current project incompatible
        self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 1
        assert response.json()["sum"]["metrics_unparam"] == 0
        assert response.json()["sum"]["metrics_null"] == 1

    def test_no_transaction(self):
        # Make current project incompatible by having nothing
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 0
        assert response.json()["sum"]["metrics_unparam"] == 0
        assert response.json()["sum"]["metrics_null"] == 0

    def test_has_transaction(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 1
        assert response.json()["sum"]["metrics_unparam"] == 0
        assert response.json()["sum"]["metrics_null"] == 0

    def test_multiple_projects(self):
        project2 = self.create_project()
        project3 = self.create_project()
        # Not setting DS, it shouldn't show up
        project4 = self.create_project()
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago, project=project4.id
        )
        self.store_transaction_metric(
            1,
            tags={"transaction": "<< unparameterized >>"},
            timestamp=self.min_ago,
            project=project2.id,
        )
        self.store_transaction_metric(
            1,
            tags={},
            timestamp=self.min_ago,
            project=project3.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "transaction": "foo_transaction"},
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 4
        assert response.json()["sum"]["metrics_unparam"] == 1
        assert response.json()["sum"]["metrics_null"] == 1

    def test_counts_add_up_correctly(self):
        # Make current project incompatible
        for _ in range(2):
            self.store_transaction_metric(
                1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
            )

        for _ in range(3):
            self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)

        for _ in range(1):
            self.store_transaction_metric(1, tags={"transaction": "/foo"}, timestamp=self.min_ago)

        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["sum"]["metrics"] == 6
        assert response.json()["sum"]["metrics_unparam"] == 2
        assert response.json()["sum"]["metrics_null"] == 3
