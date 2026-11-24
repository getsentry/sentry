from datetime import timedelta
from typing import Any

from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTimeseriesPreprodSizeEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def _do_request(self, data: dict[str, Any]) -> Response:
        with self.feature(self.features):
            return self.client_get(data=data, url=self.url)

    def _store_build(self, hour: int, size: int, app_id: str = "com.example.app") -> None:
        Factories.store_preprod_size_metric(
            project_id=self.project.id,
            organization_id=self.organization.id,
            timestamp=self.start + timedelta(hours=hour),
            max_install_size=size,
            size_metric_id=hour,
            app_id=app_id,
        )

    def test_empty_buckets_are_null(self) -> None:
        self._store_build(hour=1, size=1000000)
        self._store_build(hour=4, size=1200000)

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": "preprodSize",
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = [row["value"] for row in response.data["timeSeries"][0]["values"]]
        assert values == [None, 1000000, None, None, 1200000, None]

    def test_top_events_empty_buckets_are_null(self) -> None:
        self._store_build(hour=1, size=3000000, app_id="com.example.one")
        self._store_build(hour=3, size=1000000, app_id="com.example.two")

        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(install_size)",
                "groupBy": ["app_id"],
                "sort": "-max(install_size)",
                "topEvents": 5,
                "project": self.project.id,
                "dataset": "preprodSize",
            },
        )

        assert response.status_code == 200, response.content
        values_by_app = {
            series["groupBy"][0]["value"]: [row["value"] for row in series["values"]]
            for series in response.data["timeSeries"]
        }
        assert values_by_app == {
            "com.example.one": [None, 3000000, None, None, None, None],
            "com.example.two": [None, None, None, 1000000, None, None],
        }

    def test_no_builds_in_range(self) -> None:
        response = self._do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "max(install_size)",
                "project": self.project.id,
                "dataset": "preprodSize",
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = [row["value"] for row in response.data["timeSeries"][0]["values"]]
        assert values == [None] * 7
