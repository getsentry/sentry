import pytest
from django.urls import reverse

from sentry.api.endpoints.organization_insights_tree import OrganizationInsightsTreeEndpoint
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


@pytest.mark.snuba
@requires_snuba
class OrganizationInsightsTreeEndpointTest(
    OrganizationEventsEndpointTestBase, SnubaTestCase, SpanTestCase
):
    url_name = "sentry-api-0-organization-insights-tree"

    def setUp(self) -> None:
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

    def _store_nextjs_function_spans(self) -> None:
        # Old SDK format (<10.32.0): '{ComponentType} Server Component ({route})'
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
            # New SDK format (>=10.32.0): 'resolve {type} server component "{route_or_segment}"'
            'resolve page server component "/dashboard"',
            'resolve page server component "/nested-layout/[dynamic]"',
            'resolve layout server component "nested-layout"',
            'resolve layout server component "(route-group)"',
            'resolve layout server component "[dynamic]"',
            "resolve root layout server component",
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
            self.store_span(span)
            spans.append(span)

    def _store_unrelated_spans(self) -> None:
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
            self.store_span(span)
            spans.append(span)

    def test_get_nextjs_function_data(self) -> None:
        self.login_as(user=self.user)
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

        # New SDK format: resolve page server component with full route
        resolve_page_idx = span_descriptions.index(
            'resolve page server component "/nested-layout/[dynamic]"'
        )
        element = response.data["data"][resolve_page_idx]
        assert element["function.nextjs.component_type"] == "Page Server Component"
        assert element["function.nextjs.path"] == ["nested-layout", "[dynamic]"]

        # New SDK format: resolve layout server component with segment
        resolve_layout_idx = span_descriptions.index(
            'resolve layout server component "nested-layout"'
        )
        element = response.data["data"][resolve_layout_idx]
        assert element["function.nextjs.component_type"] == "Layout Server Component"
        assert element["function.nextjs.path"] == ["nested-layout"]

        # New SDK format: resolve root layout server component (no path)
        resolve_root_idx = span_descriptions.index("resolve root layout server component")
        element = response.data["data"][resolve_root_idx]
        assert element["function.nextjs.component_type"] == "Layout Server Component"
        assert element["function.nextjs.path"] == []

        # New SDK format: route group segment
        resolve_group_idx = span_descriptions.index(
            'resolve layout server component "(route-group)"'
        )
        element = response.data["data"][resolve_group_idx]
        assert element["function.nextjs.component_type"] == "Layout Server Component"
        assert element["function.nextjs.path"] == ["(route-group)"]

        assert "INSERT value INTO table" not in span_descriptions


class DescriptionParsingTest(TestCase):
    """Verifies that old (<10.32.0) and new (>=10.32.0) SDK formats produce identical parsed output."""

    _endpoint = OrganizationInsightsTreeEndpoint()

    def _parse(self, desc):
        response = type("R", (), {"data": {"data": [{"span.description": desc}]}})()
        self._endpoint._separate_span_description_info(response)
        row = response.data["data"][0]
        return row["function.nextjs.component_type"], row["function.nextjs.path"]

    def test_page_simple_route(self):
        assert self._parse("Page Server Component (/dashboard)") == self._parse(
            'resolve page server component "/dashboard"'
        )

    def test_page_nested_route(self):
        assert self._parse("Page Server Component (/nested/route)") == self._parse(
            'resolve page server component "/nested/route"'
        )

    def test_layout_simple_route(self):
        assert self._parse("Layout Server Component (/settings)") == self._parse(
            'resolve layout server component "/settings"'
        )
