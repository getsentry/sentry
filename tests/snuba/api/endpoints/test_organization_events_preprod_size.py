from datetime import timedelta

from django.urls import reverse

from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsPreprodSizeEndpointTest(OrganizationEventsEndpointTestBase):
    """Tests for the organization-events endpoint with the preprodSize dataset (table queries)."""

    dataset = "preprodSize"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)

    def _do_request(self, data, features=None):
        if features is None:
            features = {"organizations:preprod-frontend-routes": True}
        features.update(self.features)
        url = reverse(
            "sentry-api-0-organization-events",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, data=data, format="json")

    def test_simple_table_query(self) -> None:
        """Test basic table query returns size metrics."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=1000000,
            max_download_size=500000,
            size_metric_id=1,
            app_id="com.example.app",
        )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["app_id", "max(install_size)", "max(download_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        row = response.data["data"][0]
        assert row["app_id"] == "com.example.app"
        assert row["max(install_size)"] == 1000000
        assert row["max(download_size)"] == 500000

    def test_filter_by_app_id(self) -> None:
        """Test filtering table query by app_id."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=1000000,
            size_metric_id=1,
            app_id="com.example.app1",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=2000000,
            size_metric_id=2,
            app_id="com.example.app2",
        )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["app_id", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "query": "app_id:com.example.app1",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["app_id"] == "com.example.app1"
        assert response.data["data"][0]["max(install_size)"] == 1000000

    def test_filter_by_git_head_ref(self) -> None:
        """Test filtering table query by git_head_ref."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=1000000,
            size_metric_id=1,
            git_head_ref="main",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=2000000,
            size_metric_id=2,
            git_head_ref="feature-branch",
        )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["git_head_ref", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "query": "git_head_ref:main",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["git_head_ref"] == "main"
        assert response.data["data"][0]["max(install_size)"] == 1000000

    def test_group_by_build_configuration(self) -> None:
        """Test grouping by build_configuration_name."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=1),
            max_install_size=1000000,
            size_metric_id=1,
            build_configuration_name="Debug",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=2),
            max_install_size=1500000,
            size_metric_id=2,
            build_configuration_name="Debug",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=3),
            max_install_size=2000000,
            size_metric_id=3,
            build_configuration_name="Release",
        )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["build_configuration_name", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2

        data_by_config = {row["build_configuration_name"]: row for row in response.data["data"]}
        assert data_by_config["Debug"]["max(install_size)"] == 1500000
        assert data_by_config["Release"]["max(install_size)"] == 2000000

    def test_order_by_install_size(self) -> None:
        """Test ordering results by install_size."""
        for i, size in enumerate([3000000, 1000000, 2000000]):
            Factories.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=self.start + timedelta(hours=i),
                max_install_size=size,
                size_metric_id=i,
                app_id=f"com.example.app{i}",
            )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["app_id", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
                "sort": "-max(install_size)",
            },
        )
        assert response.status_code == 200, response.content
        sizes = [row["max(install_size)"] for row in response.data["data"]]
        assert sizes == [3000000, 2000000, 1000000]

    def test_empty_results(self) -> None:
        """Test that empty results are handled correctly."""
        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["app_id", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == []

    def test_multiple_apps_aggregation(self) -> None:
        """Test aggregation across multiple apps."""
        for i in range(3):
            Factories.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=self.start + timedelta(hours=i),
                max_install_size=1000000 * (i + 1),
                size_metric_id=i,
                app_id="com.example.app",
            )

        response = self._do_request(
            data={
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "field": ["app_id", "max(install_size)"],
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["max(install_size)"] == 3000000
