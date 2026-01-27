from datetime import timedelta
from unittest.mock import MagicMock, patch

from fixtures.page_objects.trace_view import TraceViewWaterfallPage
from sentry.eventstream.snuba import SnubaEventStream
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase, TraceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test


@no_silo_test
class TraceViewWaterfallTest(AcceptanceTestCase, TraceTestCase, SnubaTestCase):
    viewname = "sentry-api-0-organization-trace"
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

        self.page = TraceViewWaterfallPage(self.browser, self.client)
        self.dismiss_assistant()

    @patch("django.utils.timezone.now")
    def test_trace_view_waterfall_loads(self, mock_now: MagicMock) -> None:
        mock_now.return_value = self.start

        assert (
            self.browser.driver.get_window_size().get("width") == 1680
        )  # This test makes assertions based on the current default window size.

        with self.feature(self.FEATURES):
            self.create_event(
                trace_id=self.trace_id,
                transaction="root",
                start_timestamp=self.start_minus_two_minutes,
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
            )

            # Visit the trace view and wait till waterfall loads
            self.page.visit_trace_view(self.organization.slug, self.trace_id)

            # Check root span row exists and has the correct text
            root_span_row = self.page.get_trace_span_row("http.server", "root")
            assert root_span_row is not None
            normalized_text = self.page.normalize_span_row_text(root_span_row.text)
            assert normalized_text == f"{len(self.root_span_ids)} http.server - root"

            # Check child span rows exist and have the correct text
            for span_id in self.root_span_ids:
                span_row = self.page.get_trace_span_row("http.server", f"GET gen1-{span_id}")
                assert span_row is not None

                normalized_text = self.page.normalize_span_row_text(span_row.text)
                assert normalized_text == f"http.server - GET gen1-{span_id}"
