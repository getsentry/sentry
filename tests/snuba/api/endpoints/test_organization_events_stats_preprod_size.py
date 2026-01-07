from datetime import timedelta

from django.urls import reverse

from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsPreprodSizeEndpointTest(OrganizationEventsEndpointTestBase):
    """Tests for the events-stats endpoint with the preprodSize dataset."""

    dataset = "preprodSize"
    viewname = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=6)
        self.url = reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:preprod-frontend-routes": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_max_install_size_aggregate(self) -> None:
        """Test that max(install_size) aggregate returns correct values."""
        size_values = [1000000, 2000000, 3000000, 4000000, 5000000, 6000000]
        for i, size in enumerate(size_values):
            Factories.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=self.start + timedelta(hours=i),
                max_install_size=size,
                size_metric_id=i,
                app_id="com.example.app",
                git_head_ref="main",
            )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": size}] for size in size_values
        ]

    def test_max_download_size_aggregate(self) -> None:
        """Test that max(download_size) aggregate works correctly."""
        size_values = [500000, 600000, 700000]
        for i, size in enumerate(size_values):
            Factories.store_preprod_size_metric(
                project_id=self.project.id,
                organization_id=self.organization.id,
                timestamp=self.start + timedelta(hours=i),
                max_download_size=size,
                size_metric_id=i,
                app_id="com.example.app",
            )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=3),
                "interval": "1h",
                "yAxis": "max(download_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": size}] for size in size_values
        ]

    def test_zerofill_no_data(self) -> None:
        """Test that time buckets without data are zerofilled."""
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        # 6 hours + 1 = 7 buckets, all zerofilled
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 7

    def test_filter_by_app_id(self) -> None:
        """Test filtering by app_id attribute."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=0),
            max_install_size=1000000,
            size_metric_id=1,
            app_id="com.example.app1",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=0),
            max_install_size=2000000,
            size_metric_id=2,
            app_id="com.example.app2",
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
                "query": "app_id:com.example.app1",
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 1000000}]

    def test_filter_by_git_head_ref(self) -> None:
        """Test filtering by git_head_ref attribute."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=0),
            max_install_size=1000000,
            size_metric_id=1,
            git_head_ref="main",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=0),
            max_install_size=2000000,
            size_metric_id=2,
            git_head_ref="feature-branch",
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
                "query": "git_head_ref:main",
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 1000000}]

    def test_multiple_metrics_same_bucket(self) -> None:
        """Test max aggregation correctly selects largest value in same time bucket."""
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(minutes=10),
            max_install_size=1000000,
            size_metric_id=1,
            app_id="com.example.app",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(minutes=20),
            max_install_size=3000000,
            size_metric_id=2,
            app_id="com.example.app",
        )
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(minutes=30),
            max_install_size=2000000,
            size_metric_id=3,
            app_id="com.example.app",
        )

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 3000000}]
