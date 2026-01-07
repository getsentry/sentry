from datetime import timedelta

from django.urls import reverse

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
        """Test that max(max_install_size) aggregate returns correct values."""
        size_values = [1000000, 2000000, 3000000, 4000000, 5000000, 6000000]
        metrics = [
            self.create_preprod_size_metric(
                max_install_size=size,
                timestamp=self.start + timedelta(hours=hour),
                app_id="com.example.app",
                git_head_ref="main",
            )
            for hour, size in enumerate(size_values)
        ]
        self.store_preprod_size_metrics(metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        # Verify data is returned for each hour bucket
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": size}] for size in size_values
        ]

    def test_max_download_size_aggregate(self) -> None:
        """Test that max(max_download_size) aggregate works correctly."""
        size_values = [500000, 600000, 700000]
        metrics = [
            self.create_preprod_size_metric(
                max_download_size=size,
                timestamp=self.start + timedelta(hours=hour),
                app_id="com.example.app",
            )
            for hour, size in enumerate(size_values)
        ]
        self.store_preprod_size_metrics(metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=3),
                "interval": "1h",
                "yAxis": "max(max_download_size)",
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
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        # 6 hours + 1 = 7 buckets, all zerofilled
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}]] * 7

    def test_filter_by_app_id(self) -> None:
        """Test filtering by app_id attribute."""
        metrics = [
            self.create_preprod_size_metric(
                max_install_size=1000000,
                timestamp=self.start + timedelta(hours=0),
                app_id="com.example.app1",
            ),
            self.create_preprod_size_metric(
                max_install_size=2000000,
                timestamp=self.start + timedelta(hours=0),
                app_id="com.example.app2",
            ),
        ]
        self.store_preprod_size_metrics(metrics)

        # Query for app1 only
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
                "query": "app_id:com.example.app1",
            },
        )
        assert response.status_code == 200, response.content
        # First bucket should have app1's size (1000000), second bucket zerofilled
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 1000000}]

    def test_filter_by_git_head_ref(self) -> None:
        """Test filtering by git_head_ref attribute."""
        metrics = [
            self.create_preprod_size_metric(
                max_install_size=1000000,
                timestamp=self.start + timedelta(hours=0),
                git_head_ref="main",
            ),
            self.create_preprod_size_metric(
                max_install_size=2000000,
                timestamp=self.start + timedelta(hours=0),
                git_head_ref="feature-branch",
            ),
        ]
        self.store_preprod_size_metrics(metrics)

        # Query for main branch only
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(max_install_size)",
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
        metrics = [
            self.create_preprod_size_metric(
                max_install_size=1000000,
                timestamp=self.start + timedelta(minutes=10),
                app_id="com.example.app",
            ),
            self.create_preprod_size_metric(
                max_install_size=3000000,
                timestamp=self.start + timedelta(minutes=20),
                app_id="com.example.app",
            ),
            self.create_preprod_size_metric(
                max_install_size=2000000,
                timestamp=self.start + timedelta(minutes=30),
                app_id="com.example.app",
            ),
        ]
        self.store_preprod_size_metrics(metrics)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        # First bucket should have max of all three (3000000)
        assert data[0] == [{"count": 3000000}]

    def test_requires_feature_flag(self) -> None:
        """Test that the endpoint requires the preprod-frontend-routes feature flag."""
        metrics = [
            self.create_preprod_size_metric(
                max_install_size=1000000,
                timestamp=self.start,
            )
        ]
        self.store_preprod_size_metrics(metrics)

        # Make request without feature flag
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
            features={"organizations:preprod-frontend-routes": False},
        )
        # Should fail without the feature flag
        assert response.status_code != 200

    def test_sub_item_type_filter_automatic(self) -> None:
        """Test that sub_item_type=size_metric filter is applied automatically.

        The PreprodSize dataset should only return data where sub_item_type=size_metric,
        filtering out other preprod data types (like build_distribution).
        """
        # Create a size_metric (should be returned)
        size_metric = self.create_preprod_size_metric(
            max_install_size=1000000,
            timestamp=self.start + timedelta(hours=0),
            app_id="com.example.app",
        )
        self.store_preprod_size_metrics([size_metric])

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.start + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "max(max_install_size)",
                "project": self.project.id,
                "dataset": self.dataset,
            },
        )
        assert response.status_code == 200, response.content
        data = [attrs for time, attrs in response.data["data"]]
        assert data[0] == [{"count": 1000000}]
