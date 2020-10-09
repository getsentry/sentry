from __future__ import absolute_import

import pytz

from six.moves.urllib.parse import urlencode
from mock import patch

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data

from .page_objects.transaction_summary import TransactionSummaryPage

FEATURE_NAMES = ("organizations:performance-view",)


def make_event(event_data):
    event_data["event_id"] = "c" * 32
    return event_data


class PerformanceSummaryTest(AcceptanceTestCase, SnubaTestCase):
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

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        # Create a transaction
        event = make_event(load_data("transaction", timestamp=before_now(minutes=1)))
        self.store_event(data=event, project_id=self.project.id)
        self.wait_for_event_count(self.project.id, 1)

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

    @patch("django.utils.timezone.now")
    def test_view_details_from_summary(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event = make_event(load_data("transaction", timestamp=before_now(minutes=1)))
        self.store_event(data=event, project_id=self.project.id)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()

            # View the first event details.
            self.browser.element('[data-test-id="view-details"]').click()
            self.page.wait_until_loaded()
            self.browser.snapshot("performance event details")

    @patch("django.utils.timezone.now")
    def test_real_user_monitoring(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        rum_path = u"/organizations/{}/performance/summary/rum/?{}".format(
            self.org.slug,
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

        # Create a transaction
        event_data = load_data("transaction", timestamp=before_now(minutes=1))
        # only frontend pageload transactions can be shown on the RUM tab
        event_data["contexts"]["trace"]["op"] = "pageload"
        event_data["measurements"]["fp"]["value"] = 5000
        event = make_event(event_data)
        self.store_event(data=event, project_id=self.project.id)
        self.wait_for_event_count(self.project.id, 1)

        with self.feature(list(FEATURE_NAMES) + ["organizations:measurements"]):
            self.browser.get(rum_path)
            self.page.wait_until_loaded()
            self.browser.wait_until_not('[data-test-id="stats-loading"]')

            self.browser.snapshot("real user monitoring")

    @patch("django.utils.timezone.now")
    def test_real_user_monitoring_filtering(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        rum_path = u"/organizations/{}/performance/summary/rum/?{}".format(
            self.org.slug,
            urlencode({"transaction": "/country_by_code/", "project": self.project.id}),
        )

        # Create transactions
        for seconds in range(3):
            event_data = load_data("transaction", timestamp=before_now(minutes=2))
            event_data["contexts"]["trace"]["op"] = "pageload"
            event_data["event_id"] = ("c" * 31) + hex(seconds)[2:]
            event_data["measurements"]["fp"]["value"] = seconds * 10
            event_data["measurements"]["fcp"]["value"] = seconds * 10
            event_data["measurements"]["lcp"]["value"] = seconds * 10
            event_data["measurements"]["fid"]["value"] = seconds * 10
            self.store_event(data=event_data, project_id=self.project.id)

        # add anchor point
        event_data = load_data("transaction", timestamp=before_now(minutes=1))
        event_data["contexts"]["trace"]["op"] = "pageload"
        event_data["event_id"] = "a" * 32
        event_data["measurements"]["fp"]["value"] = 3000
        event_data["measurements"]["fcp"]["value"] = 3000
        event_data["measurements"]["lcp"]["value"] = 3000
        event_data["measurements"]["fid"]["value"] = 3000
        self.store_event(data=event_data, project_id=self.project.id)

        # add outlier
        event_data = load_data("transaction", timestamp=before_now(minutes=1))
        event_data["contexts"]["trace"]["op"] = "pageload"
        event_data["event_id"] = "b" * 32
        event_data["measurements"]["fp"]["value"] = 3000000000
        event_data["measurements"]["fcp"]["value"] = 3000000000
        event_data["measurements"]["lcp"]["value"] = 3000000000
        event_data["measurements"]["fid"]["value"] = 3000000000
        self.store_event(data=event_data, project_id=self.project.id)

        self.wait_for_event_count(self.project.id, 5)

        with self.feature(list(FEATURE_NAMES) + ["organizations:measurements"]):
            self.browser.get(rum_path)
            self.page.wait_until_loaded()
            self.browser.wait_until_not('[data-test-id="stats-loading"]')

            self.browser.snapshot("real user monitoring - exclude outliers")

            self.browser.element(
                xpath="//button//span[contains(text(), 'Exclude Outliers')]"
            ).click()

            self.browser.element(xpath="//li//span[contains(text(), 'View All')]").click()

            self.browser.snapshot("real user monitoring - view all data")
