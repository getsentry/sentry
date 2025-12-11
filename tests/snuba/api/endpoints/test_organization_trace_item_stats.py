from django.urls import reverse

from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


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

    def test_missing_stats_type(self) -> None:
        self._store_span()
        response = self.do_request(query={})
        assert response.status_code == 400, response.data
        assert "statsType" in response.data

    def test_invalid_stats_type(self) -> None:
        self._store_span()
        response = self.do_request(query={"statsType": ["invalid_type"]})
        assert response.status_code == 400, response.data

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

    def test_substring_match_filters_attributes(self) -> None:
        tags = [
            ({"browser.name": "chrome", "browser.version": "120", "device": "desktop"}, 100),
            ({"browser.name": "firefox", "device": "mobile"}, 100),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        response = self.do_request(
            query={
                "statsType": ["attributeDistributions"],
                "substringMatch": "browser",
            }
        )
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        attribute_distribution = response.data["data"][0]["attribute_distributions"]["data"]

        assert "browser.name" in attribute_distribution
        assert "device" not in attribute_distribution

    def test_substring_match_returns_known_public_aliases(self) -> None:
        # Store spans with known sentry attributes (op, description)
        self.store_span(
            self.create_span(
                {
                    "sentry_tags": {"custom_attr": "value1", "op": "http.client"},
                },
                start_ts=self.ten_mins_ago,
                duration=100,
            ),
            is_eap=True,
        )
        self.store_span(
            self.create_span(
                {
                    "sentry_tags": {"other_attr": "value2", "op": "db.query"},
                },
                start_ts=self.ten_mins_ago,
                duration=200,
            ),
            is_eap=True,
        )

        response = self.do_request(
            query={
                "statsType": ["attributeDistributions"],
                "substringMatch": "span.",
            }
        )
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        attribute_distribution = response.data["data"][0]["attribute_distributions"]["data"]

        assert "span.op" in attribute_distribution
        description_labels = [item["label"] for item in attribute_distribution["span.op"]]
        assert "http.client" in description_labels
        assert "db.query" in description_labels

        assert "custom_attr" not in attribute_distribution
        assert "other_attr" not in attribute_distribution

    def test_query_filters_spans_before_stats(self) -> None:
        tags = [
            ({"browser": "chrome", "device": "desktop"}, 100),
            ({"browser": "firefox", "device": "mobile"}, 100),
            ({"browser": "safari", "device": "tablet"}, 500),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        response = self.do_request(
            query={
                "query": "browser:chrome",
                "statsType": ["attributeDistributions"],
            }
        )
        assert response.status_code == 200, response.data
        assert len(response.data["data"]) == 1
        attribute_distribution = response.data["data"][0]["attribute_distributions"]["data"]

        device_data = attribute_distribution.get("sentry.device", [])
        assert any(item["label"] == "desktop" for item in device_data)
        assert not any(
            item["label"] == "mobile" or item["label"] == "tablet" for item in device_data
        )

    @override_options({"explore.trace-items.keys.max": 3})
    def test_pagination_with_limit(self) -> None:
        tags = [
            {"attr1": "value1"},
            {"attr2": "value2"},
            {"attr3": "value3"},
            {"attr4": "value4"},
        ]

        for tag in tags:
            self._store_span(tags=tag)

        response = self.do_request(
            query={
                "statsType": ["attributeDistributions"],
            }
        )
        assert response.status_code == 200, response.data

        links = {}
        if "Link" in response:
            for url, attrs in parse_link_header(response["Link"]).items():
                links[attrs["rel"]] = attrs
                attrs["href"] = url

            assert links["previous"]["results"] == "false"

            if links.get("next", {}).get("results") == "true":
                assert links["next"]["href"] is not None
                next_response = self.client.get(links["next"]["href"], format="json")
                assert next_response.status_code == 200, next_response.content

    @override_options({"explore.trace-items.keys.max": 2})
    def test_custom_limit_parameter(self) -> None:
        tags = [
            {"custom1": "value1"},
            {"custom2": "value2"},
            {"custom3": "value3"},
        ]

        for tag in tags:
            self._store_span(tags=tag)

        response = self.do_request(
            query={
                "statsType": ["attributeDistributions"],
                "limit": 1,
            }
        )
        assert response.status_code == 200, response.data

        assert len(response.data["data"]) == 1
        attribute_distribution = response.data["data"][0]["attribute_distributions"]["data"]
        assert (
            len(attribute_distribution) == 2
        )  # We return limit + 1 to check if there is a next page

        if "Link" in response:
            links = {}
            for url, attrs in parse_link_header(response["Link"]).items():
                links[attrs["rel"]] = attrs

            assert links["previous"]["results"] == "false"
