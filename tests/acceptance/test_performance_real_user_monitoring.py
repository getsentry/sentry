from __future__ import absolute_import

import pytz

from six.moves.urllib.parse import urlencode
from mock import patch

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

from .page_objects.transaction_summary import TransactionSummaryPage

FEATURE_NAMES = ["organizations:performance-view", "organizations:measurements"]


def make_event(event_data):
    event_data["event_id"] = "c" * 32
    return event_data


class PerformanceRealUserMonitoringTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(PerformanceRealUserMonitoringTest, self).setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = u"/organizations/{}/performance/summary/rum/?{}".format(
            self.org.slug,
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

        self.page = TransactionSummaryPage(self.browser)

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    @patch("django.utils.timezone.now")
    def test_real_user_monitoring(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        # Create a transaction
        event = make_event(load_data("transaction", timestamp=before_now(minutes=1)))
        self.store_event(data=event, project_id=self.project.id)
        self.wait_for_event_count(self.project.id, 1)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.wait_until_loaded()

            self.browser.snapshot("real user monitoring")
