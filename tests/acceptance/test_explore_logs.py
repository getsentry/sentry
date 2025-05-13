from datetime import timedelta
from unittest.mock import patch

from fixtures.page_objects.explore_logs import ExploreLogsPage
from sentry.testutils.cases import AcceptanceTestCase, OurLogTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

FEATURE_FLAGS = [
    "organizations:ourlogs-enabled",
]


@no_silo_test
class ExploreLogsTest(AcceptanceTestCase, SnubaTestCase, OurLogTestCase):
    viewname = "sentry-api-0-organization-events"

    def setUp(self):
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
        self.features = {
            "organizations:ourlogs-enabled": True,
        }
        self.login_as(self.user)

        self.page = ExploreLogsPage(self.browser, self.client)
        self.dismiss_assistant()

    @patch("django.utils.timezone.now")
    def test_opening_log_row_shows_attributes(self, mock_now):
        mock_now.return_value = self.start

        assert (
            self.browser.driver.get_window_size().get("width") == 1680
        )  # This test makes assertions based on the current default window size.

        with self.feature(FEATURE_FLAGS):
            logs = [
                self.create_ourlog(
                    {"body": "check these attributes"},
                    timestamp=self.start_minus_one_minute,
                    attributes={
                        "test.attribute1": {"string_value": "value1"},
                        "test.attribute2": {"string_value": "value2"},
                        "long_attribute": {"string_value": "a" * 1000},
                        "int_attribute": {"int_value": 1234567890},
                        "double_attribute": {"double_value": 1234567890.1234567890},
                        "bool_attribute": {"bool_value": True},
                        "another.attribute": {"string_value": "value3"},
                        "nested.attribute1": {"string_value": "nested value1"},
                        "nested.attribute2": {"string_value": "nested value2"},
                        "nested.attribute3": {"string_value": "nested value3"},
                    },
                ),
                self.create_ourlog(
                    {"body": "ignore this log"},
                    timestamp=self.start_minus_two_minutes,
                ),
            ]
            self.store_ourlogs(logs)

            self.page.visit_explore_logs(self.organization.slug)
            row = self.page.toggle_log_row_with_message("check these attributes")
            columns = self.page.get_log_row_columns(row)
            assert len(columns) == 2

            assert "double_attribute" in columns[0].text
            assert "1234567890" in columns[0].text
            assert "long_attribute" in columns[0].text
            assert "a" * 1000 in columns[0].text
            assert "nested value1" in columns[0].text
            assert "nested value2" in columns[0].text
            assert "nested value3" in columns[0].text
            assert "value1" in columns[1].text
