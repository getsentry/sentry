import pytest
from django.urls import reverse

from sentry.testutils import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationMetricsCompatiblity(MetricsEnhancedPerformanceTestCase):
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
        self.bad_project = self.create_project()

    def test_unparameterized_transactions(self):
        # Make current project incompatible
        self.store_transaction_metric(
            1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["incompatible_projects"] == [self.project.id, self.bad_project.id]
        assert response.data["compatible_projects"] == []
        assert response.data["dynamic_sampling_projects"] == [self.project.id]

    def test_null_transaction(self):
        # Make current project incompatible
        self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["incompatible_projects"] == [self.project.id, self.bad_project.id]
        assert response.data["compatible_projects"] == []
        assert response.data["dynamic_sampling_projects"] == [self.project.id]

    def test_no_transaction(self):
        # Make current project incompatible by having nothing
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["incompatible_projects"] == [self.project.id, self.bad_project.id]
        assert response.data["compatible_projects"] == []
        assert response.data["dynamic_sampling_projects"] == [self.project.id]

    def test_has_transaction(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["incompatible_projects"] == [self.bad_project.id]
        assert response.data["compatible_projects"] == [self.project.id]
        assert response.data["dynamic_sampling_projects"] == [self.project.id]

    def test_multiple_projects(self):
        project2 = self.create_project()
        project2.update_option("sentry:dynamic_sampling", "something-it-doesn't-matter")
        project3 = self.create_project()
        project3.update_option("sentry:dynamic_sampling", "something-it-doesn't-matter")
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
            data={"timestamp": iso_format(self.min_ago), "transaction": "foo_transaction"},
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["incompatible_projects"] == sorted(
            [project2.id, project3.id, project4.id, self.bad_project.id]
        )
        assert response.data["compatible_projects"] == [self.project.id]
        assert response.data["dynamic_sampling_projects"] == [
            self.project.id,
            project2.id,
            project3.id,
        ]

    def test_no_ds(self):
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, data={"project": [self.bad_project.id]}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["dynamic_sampling_projects"] == []
        assert response.data["incompatible_projects"] == []
        assert response.data["compatible_projects"] == []


@region_silo_test
class OrganizationEventsMetricsSums(MetricsEnhancedPerformanceTestCase):
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

    def test_unparameterized_transactions(self):
        # Make current project incompatible
        self.store_transaction_metric(
            1, tags={"transaction": "<< unparameterized >>"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 1
        assert response.data["sum"]["metrics_unparam"] == 1
        assert response.data["sum"]["metrics_null"] == 0

    def test_null_transaction(self):
        # Make current project incompatible
        self.store_transaction_metric(1, tags={}, timestamp=self.min_ago)
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 1
        assert response.data["sum"]["metrics_unparam"] == 0
        assert response.data["sum"]["metrics_null"] == 1

    def test_no_transaction(self):
        # Make current project incompatible by having nothing
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 0
        assert response.data["sum"]["metrics_unparam"] == 0
        assert response.data["sum"]["metrics_null"] == 0

    def test_has_transaction(self):
        self.store_transaction_metric(
            1, tags={"transaction": "foo_transaction"}, timestamp=self.min_ago
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 1
        assert response.data["sum"]["metrics_unparam"] == 0
        assert response.data["sum"]["metrics_null"] == 0

    def test_multiple_projects(self):
        project2 = self.create_project()
        project2.update_option("sentry:dynamic_sampling", "something-it-doesn't-matter")
        project3 = self.create_project()
        project3.update_option("sentry:dynamic_sampling", "something-it-doesn't-matter")
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
            data={"timestamp": iso_format(self.min_ago), "transaction": "foo_transaction"},
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-metrics-compatibility-sums",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 4
        assert response.data["sum"]["metrics_unparam"] == 1
        assert response.data["sum"]["metrics_null"] == 1

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
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["sum"]["metrics"] == 6
        assert response.data["sum"]["metrics_unparam"] == 2
        assert response.data["sum"]["metrics_null"] == 3
