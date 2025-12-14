from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest

from fixtures.page_objects.explore_spans import ExploreSpansPage
from fixtures.page_objects.trace_view import TraceViewWaterfallPage
from sentry.eventstream.snuba import SnubaEventStream
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase, TraceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test


@no_silo_test
class TraceViewFromExploreTest(AcceptanceTestCase, TraceTestCase, SnubaTestCase):
    viewname = "sentry-api-0-organization-events"
    FEATURES = [
        "organizations:visibility-explore-view",
        "organizations:performance-view",
        "organizations:trace-spans-format",
    ]

    def setUp(self) -> None:
        super().setUp()
        self.snuba_eventstream = SnubaEventStream()
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )

        self.start_minus_two_minutes = self.start - timedelta(minutes=2)

        self.organization = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.organization, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.login_as(self.user)

        self.page = ExploreSpansPage(self.browser, self.client)

        self.trace_view_page = TraceViewWaterfallPage(self.browser, self.client)
        self.dismiss_assistant(which="tour.explore.spans")

    @patch("django.utils.timezone.now")
    @pytest.mark.skip(reason="This test is flaky and needs to be fixed")
    def test_navigation(self, mock_now: MagicMock) -> None:
        mock_now.return_value = self.start

        assert (
            self.browser.driver.get_window_size().get("width") == 1680
        )  # This test makes assertions based on the current default window size.

        with self.feature(self.FEATURES):
            self.create_event(
                trace_id=self.trace_id,
                start_timestamp=self.start_minus_two_minutes,
                transaction="root",
                spans=[
                    {
                        "same_process_as_parent": True,
                        "op": "http.server",
                        "description": f"GET gen1-{root_span_id}",
                        "span_id": root_span_id,
                        "trace_id": self.trace_id,
                    }
                    for i, root_span_id in enumerate(self.root_span_ids)
                ],
                parent_span_id=None,
                project_id=self.project.id,
                milliseconds=3000,
                is_eap=True,
            )

            # Visit explore spans table
            self.page.visit_explore_spans(self.organization.slug)

            # Click on the first span in the explore spans table
            self.page.click_on_span_id(self.root_span_ids[0][:8])

            # Wait for the trace view to load and check that the spans are in the trace view waterfall
            self.trace_view_page.wait_until_loaded()
            for span_id in self.root_span_ids:
                span_row = self.trace_view_page.get_trace_span_row(
                    "http.server", f"GET gen1-{span_id}"
                )
                assert span_row is not None

                normalized_text = self.trace_view_page.normalize_span_row_text(span_row.text)
                assert normalized_text == f"http.server - GET gen1-{span_id}"
