from django.urls import reverse

from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTraceItemsAttributesRankedEndpointTest(
    APITransactionTestCase,
    SnubaTestCase,
    SpanTestCase,
):
    view = "sentry-api-0-organization-trace-item-attributes-ranked"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:performance-spans-suspect-attributes": True,
        }
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-spans-suspect-attributes"]

        if query and "type" not in query.keys():
            query["type"] = "string"

        if query:
            query.setdefault("sampling", "HIGHEST_ACCURACY")

        with self.feature(features):
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
        assert response.data == {"rankedAttributes": []}

    def test_no_feature(self) -> None:
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

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
            query={"query_1": "span.duration:<=100", "query_2": "span.duration:>100"}
        )
        assert response.status_code == 200, response.data
        distributions = response.data["rankedAttributes"]
        attribute = next(a for a in distributions if a["attributeName"] == "sentry.device")
        assert attribute
        assert attribute["cohort1"] == [
            {"label": "mobile", "value": 3.0},
            {"label": "desktop", "value": 1.0},
        ]
        assert attribute["cohort2"] == [{"label": "desktop", "value": 3.0}]

        attribute = next(a for a in distributions if a["attributeName"] == "browser")
        assert attribute["attributeName"] == "browser"
