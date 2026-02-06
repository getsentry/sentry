from datetime import timedelta
from unittest.mock import MagicMock, patch

from fixtures.page_objects.explore_spans import ExploreSpansPage
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

FEATURE_FLAGS = [
    "organizations:visibility-explore-view",
]


@no_silo_test
class ExploreSpansTest(AcceptanceTestCase, SpanTestCase, SnubaTestCase):
    viewname = "sentry-api-0-organization-events"

    def setUp(self) -> None:
        super().setUp()
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )

        self.start_minus_one_minute = self.start - timedelta(minutes=1)
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
        self.dismiss_assistant(which="tour.explore.spans")

    @patch("django.utils.timezone.now")
    def test_spans_table_loads_all_events(self, mock_now: MagicMock) -> None:
        mock_now.return_value = self.start

        assert (
            self.browser.driver.get_window_size().get("width") == 1680
        )  # This test makes assertions based on the current default window size.

        with self.feature(FEATURE_FLAGS):
            spans = [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.start_minus_one_minute,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.start_minus_two_minutes,
                ),
            ]
            self.store_spans(
                spans,
            )

            self.page.visit_explore_spans(self.organization.slug)
            for span in spans:
                span_row = self.page.get_spans_row_with_id(span["span_id"][:8])
                column_objects = self.page.get_spans_row_columns(span_row)
                row_text = [element.text for element in column_objects]
                # Just checking that the attrs of the span are here so test isn't dependent on the order of columns
                assert span["span_id"][:8] in row_text
                assert span["description"] in row_text
