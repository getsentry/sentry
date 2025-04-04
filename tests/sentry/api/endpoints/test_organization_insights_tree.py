from unittest.mock import patch

import pytest
from django.urls import reverse

from sentry.testutils.cases import SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data
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
        self.nine_mins_ago = before_now(minutes=9)
        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()
        self.eleven_mins_ago = before_now(minutes=11)
        self.eleven_mins_ago_iso = self.eleven_mins_ago.isoformat()
        self.transaction_data = load_data("transaction", timestamp=self.ten_mins_ago)
        self.features = {}

        self.ten_mins_ago = before_now(minutes=10)
        self.ten_mins_ago_iso = self.ten_mins_ago.replace(microsecond=0).isoformat()
        self.login_as(user=self.user)
        self.url = reverse(
            self.url_name,
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
            },
        )

    @patch("sentry.snuba.spans_rpc.run_table_query")
    def test_get_nextjs_function_data(self, mock_run_table_query):

        self.create_environment(self.project, name="production")
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

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "statsPeriod": "14d",
                    "useRpc": True,
                    "noPagination": True,
                    "query": "span.op:function.nextjs",
                    "mode": "aggregate",
                    "field": ["span.description", "avg(span.duration)", "count(span.duration)"],
                    "project": self.project.id,
                    "dataset": "spans",
                },
            )
        assert response.status_code == 200
