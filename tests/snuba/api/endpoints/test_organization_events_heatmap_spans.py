from datetime import timedelta
from typing import Any

from django.urls import reverse
from rest_framework.response import Response

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsHeatmapSpansEndpointTest(OrganizationEventsEndpointTestBase):
    endpoint = "sentry-api-0-organization-events-heatmap"
    dataset = "spans"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)
        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.base_data = {
            "start": self.start,
            "end": self.end,
            "interval": "1h",
            "yBuckets": 6,
            "project": self.project.id,
            "dataset": self.dataset,
        }

    def _do_request(self, data: dict[str, Any], dev_features: bool = True) -> Response:
        with self.feature({"organizations:explore-dev-features": dev_features}):
            return self.client_get(data=data, url=self.url)

    def test_span_duration(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo"},
                    duration=100 * (hour + 1),
                    start_ts=self.start + timedelta(hours=hour, minutes=1),
                )
                for hour in range(6)
            ],
        )

        response = self._do_request(data={**self.base_data, "yAxis": "span.duration"})
        assert response.status_code == 200, response.content
        expected_response = []
        for time in range(6):
            for yAxis in range(6):
                expected_response.append(
                    {
                        "xAxis": (self.start.timestamp() + (3600 * time)) * 1000,
                        "yAxis": 100 + 500 / 6 * yAxis,
                        "zAxis": 1 if time == yAxis else 0,
                    }
                )
        assert response.data["values"] == expected_response
        assert response.data["meta"] == {
            "dataset": "spans",
            "xAxis": {
                "name": "time",
                "start": self.start.timestamp() * 1000,
                "end": self.end.timestamp() * 1000,
                "bucketCount": 6,
                "bucketSize": 3600,
            },
            "yAxis": {
                "name": "span.duration",
                "start": 100,
                "end": 600,
                "bucketCount": 6,
                "bucketSize": 500 / 6,
                "logarithmic": False,
            },
            "zAxis": {
                "name": "count()",
                "start": 0,
                "end": 1,
            },
        }

    def test_defaults_to_span_duration(self) -> None:
        self.store_spans(
            [self.create_span({"description": "foo"}, duration=100, start_ts=self.start)],
        )

        response = self._do_request(data=self.base_data)
        assert response.status_code == 200, response.content
        assert response.data["meta"]["yAxis"]["name"] == "span.duration"

    def test_requires_dev_features(self) -> None:
        response = self._do_request(
            data={**self.base_data, "yAxis": "span.duration"}, dev_features=False
        )
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "spans is not supported on this endpoint"

    def test_y_axis_not_in_allowlist(self) -> None:
        for y_axis in ["span.op", "value", "measurements.lcp"]:
            response = self._do_request(data={**self.base_data, "yAxis": y_axis})
            assert response.status_code == 400, response.content
            assert response.data["detail"] == "yAxis must be one of span.duration, span.self_time"
