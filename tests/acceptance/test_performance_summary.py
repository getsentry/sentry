from __future__ import absolute_import

from datetime import timedelta
import pytz
import time

from six.moves.urllib.parse import urlencode
from mock import patch

from sentry.testutils import AcceptanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data

from .page_objects.transaction_summary import TransactionSummaryPage

FEATURE_NAMES = (
    "organizations:discover-basic",
    "organizations:transaction-events",
    "organizations:performance-view",
)


def make_event(event_data):
    start_datetime = before_now(minutes=1)
    end_datetime = start_datetime + timedelta(milliseconds=500)

    def generate_timestamp(date_time):
        return time.mktime(date_time.utctimetuple()) + date_time.microsecond / 1e6

    event_data["start_timestamp"] = generate_timestamp(start_datetime)
    event_data["timestamp"] = generate_timestamp(end_datetime)
    event_data["event_id"] = "c" * 32

    return event_data


class PerformanceSummaryTest(AcceptanceTestCase):
    def setUp(self):
        super(PerformanceSummaryTest, self).setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = u"/organizations/{}/performance/summary/?{}".format(
            self.org.slug,
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

        self.page = TransactionSummaryPage(self.browser)
        self.dismiss_assistant()

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        # Create a transaction
        event = make_event(load_data("transaction"))
        self.store_event(data=event, project_id=self.project.id)

        self.store_event(
            data={
                "transaction": "/country_by_code/",
                "message": "This is bad",
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            self.browser.snapshot("performance summary - with data")
