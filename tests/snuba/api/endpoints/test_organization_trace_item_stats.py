from typing import int
from django.urls import reverse

from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemsStatsEndpointTest(
    APITransactionTestCase,
    SnubaTestCase,
    SpanTestCase,
):
    view = "sentry-api-0-organization-trace-item-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()

    def do_request(self, query=None, features=None, **kwargs):
        if query:
            query.setdefault("sampling", "HIGHEST_ACCURACY")

        response = self.client.get(
            reverse(
                self.view,
                kwargs={"organization_id_or_slug": self.organization.slug},
            ),
            query,
            format="json",
            **kwargs,
        )

        return response

    def _store_span(self, description=None, tags=None, duration=None):
        if tags is None:
            tags = {"foo": "bar"}

        self.store_span(
            self.create_span(
                {"description": description or "foo", "sentry_tags": tags},
                start_ts=self.ten_mins_ago,
                duration=duration or 1000,
            ),
            is_eap=True,
        )

    def test_no_project(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == {"data": []}

    def test_distribution_values(self) -> None:
        tags = [
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 100),
            ({"browser": "safari", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "edge", "device": "desktop"}, 500),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        response = self.do_request(
            query={"query": "span.duration:<=100", "statsType": ["attributeDistributions"]}
        )
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        attribute_distribution = response.data["data"][0]["attribute_distributions"]["data"]
        device_data = attribute_distribution["sentry.device"]
        assert {"label": "mobile", "value": 3.0} in device_data
        assert {"label": "desktop", "value": 1.0} in device_data

        assert response.data
