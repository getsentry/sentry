from datetime import timezone
from unittest.mock import patch
from urllib.parse import urlencode

from django.db.models import F

from fixtures.page_objects.base import BasePage
from sentry.models.project import Project
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data


@no_silo_test
class PerformanceTrendsTest(AcceptanceTestCase, SnubaTestCase):
    def make_trend(
        self,
        name,
        durations,
        period_mins=60,
    ):
        for index, duration in enumerate(durations):
            time_between = period_mins / len(durations)
            # distirbute events over the period
            minutes = period_mins - ((index + 1) * time_between) + (time_between / 2)
            event = load_data("transaction")
            event.update(
                {
                    "transaction": name,
                    "event_id": f"{index:02x}".rjust(32, "0"),
                    "start_timestamp": iso_format(before_now(minutes=minutes, seconds=duration)),
                    "timestamp": iso_format(before_now(minutes=minutes)),
                }
            )
            self.store_event(data=event, project_id=self.project.id)

    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = "/organizations/{}/performance/trends/?{}".format(
            self.org.slug,
            urlencode(
                {
                    "query": "transaction.duration:>0",
                    "statsPeriod": "1h",
                    "project": self.project.id,
                }
            ),
        )

        self.page = BasePage(self.browser)

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=timezone.utc)
        values = range(1, 100, 5)

        self.make_trend("improvement", [v for v in reversed(values)])
        self.make_trend("regression", values)

        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        with self.feature("organizations:performance-view"):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            trend_item = '[data-test-id="trends-list-item-regression"]'
            self.browser.wait_until(trend_item)
