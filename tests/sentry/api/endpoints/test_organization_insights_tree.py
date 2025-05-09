import pytest
from django.urls import reverse

from sentry.testutils.cases import SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


@pytest.mark.snuba
@requires_snuba
class OrganizationInsightsTreeEndpointTest(
    OrganizationEventsEndpointTestBase, SnubaTestCase, SpanTestCase
):
    url_name = "sentry-api-0-organization-insights-tree"
    FEATURES = ["organizations:trace-spans-format"]

    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)
        self.features = {}
        self.url = reverse(
            self.url_name,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
            },
        )

        self.create_environment(self.project, name="production")
        self._store_nextjs_function_spans()
        self._store_unrelated_spans()

    def _store_nextjs_function_spans(self):
        descriptions = [
            "Page Server Component (/app/dashboard/)",
            "Loading Server Component (/app/dashboard/)",
            "Layout Server Component (/app/)",
            "Not-found Server Component (/app/dashboard/)",
            "Head Server Component (/app/dashboard/)",
            "Unknown Server Component (/app/dashboard/)",
            "Page.generateMetadata (/app/dashboard/)",
            "Page.generateImageMetadata (/app/dashboard/)",
            "Page.generateViewport (/app/dashboard/)",
            "Page Server Component (/app/dashboard/settings/)",
            "Page Server Component (/app/dashboard/users/)",
            "Layout Server Component (/app/dashboard/)",
            "Page Server Component (/)",
            "Page Server Component (/app/dashboard/[userId]/)",
            "Page Server Component (/app/[category]/[product]/)",
            "Layout Server Component (/app/[id]/)",
            "Page Server Component (/app/[id]/)",
            "Page Server Component (/app/[...slug]/)",
            "Page Server Component (/app/[[...optional]]/)",
            "unrelated description",
        ]
        spans = []
        for description in descriptions:
            span = self.create_span(
                {"description": description},
                organization=self.project.organization,
                project=self.project,
                duration=100,
                start_ts=self.ten_mins_ago,
            )
            span["sentry_tags"]["op"] = "function.nextjs"
            self.store_span(span, is_eap=True)
            spans.append(span)

    def _store_unrelated_spans(self):
        descriptions = [
            "INSERT value INTO table",
            "SELECT * FROM table",
        ]
        spans = []
        for description in descriptions:
            span = self.create_span(
                {"description": description},
                organization=self.project.organization,
                project=self.project,
                duration=100,
                start_ts=self.ten_mins_ago,
            )
            span["sentry_tags"]["op"] = "db"
            self.store_span(span, is_eap=True)
            spans.append(span)

    def test_get_nextjs_function_data(self):
        self.login_as(user=self.user)
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "statsPeriod": "14d",
                    "noPagination": True,
                    "query": "span.op:function.nextjs",
                    "mode": "aggregate",
                    "field": ["span.description", "avg(span.duration)", "count(span.duration)"],
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
        assert response.status_code == 200
        span_descriptions = [row["span.description"] for row in response.data["data"]]
        assert "Page Server Component (/app/[category]/[product]/)" in span_descriptions

        root_route_idx = span_descriptions.index("Page Server Component (/)")
        element = response.data["data"][root_route_idx]
        assert element["function.nextjs.component_type"] == "Page Server Component"
        assert element["function.nextjs.path"] == []

        unparameterized_route_idx = span_descriptions.index(
            "Page.generateMetadata (/app/dashboard/)"
        )
        element = response.data["data"][unparameterized_route_idx]
        assert element["function.nextjs.component_type"] == "Page.generateMetadata"
        assert element["function.nextjs.path"] == ["app", "dashboard"]

        parameterized_route_idx = span_descriptions.index(
            "Page Server Component (/app/[category]/[product]/)"
        )
        element = response.data["data"][parameterized_route_idx]
        assert element["function.nextjs.component_type"] == "Page Server Component"
        assert element["function.nextjs.path"] == ["app", "[category]", "[product]"]

        catchall_route_idx = span_descriptions.index("Page Server Component (/app/[...slug]/)")
        element = response.data["data"][catchall_route_idx]
        assert element["function.nextjs.component_type"] == "Page Server Component"
        assert element["function.nextjs.path"] == ["app", "[...slug]"]

        assert "INSERT value INTO table" not in span_descriptions
