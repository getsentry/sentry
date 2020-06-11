from __future__ import absolute_import

from datetime import timedelta
import pytz
import time

from mock import patch

from django.db.models import F
from sentry.models import Project
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

from .page_objects.base import BasePage

FEATURE_NAMES = (
    "organizations:discover-basic",
    "organizations:performance-view",
)


def make_event(event_data):
    start_datetime = before_now(minutes=1)
    end_datetime = start_datetime + timedelta(milliseconds=500)

    def generate_timestamp(date_time):
        return time.mktime(date_time.utctimetuple()) + date_time.microsecond / 1e6

    event_data["start_timestamp"] = generate_timestamp(start_datetime)
    event_data["timestamp"] = generate_timestamp(end_datetime)

    return event_data


class PerformanceOverviewTest(AcceptanceTestCase):
    def setUp(self):
        super(PerformanceOverviewTest, self).setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = u"/organizations/{}/performance/".format(self.org.slug)

        self.page = BasePage(self.browser)
        self.dismiss_assistant("discover_sidebar")

    @patch("django.utils.timezone.now")
    def test_onboarding(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            self.browser.snapshot("performance overview - onboarding")

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event = make_event(load_data("transaction"))
        self.store_event(data=event, project_id=self.project.id)
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            self.browser.snapshot("performance overview - with data")
