from __future__ import absolute_import

import pytz

from six.moves.urllib.parse import urlencode
from mock import patch

from django.db.models import F
from sentry.models import Project
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data

from .page_objects.base import BasePage

FEATURE_NAMES = (
    "organizations:trends",
    "organizations:performance-view",
)


def make_nth_transaction(base_event, name, n, start, end):
    event = base_event.copy()

    event["transaction"] = name
    event["event_id"] = "{:02x}".format(n).rjust(32, "0")
    event["start_timestamp"] = iso_format(start)
    event["timestamp"] = iso_format(end)

    return event


def make_trend(
    store_event,
    project_id,
    event,
    name,
    first_duration,
    second_duration,
    number_transactions=2,
    period_mins=60,
):
    for i in range(number_transactions):
        time_between = period_mins / number_transactions
        minutes = period_mins - ((i + 1) * time_between) + (time_between / 2)
        if i < (number_transactions / 2):
            event_start = before_now(minutes=minutes, seconds=first_duration)
        else:
            event_start = before_now(minutes=minutes, seconds=second_duration)
        event_end = before_now(minutes=minutes)
        transaction = make_nth_transaction(event, name, i, event_start, event_end)
        store_event(data=transaction, project_id=project_id)


class PerformanceTrendsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(PerformanceTrendsTest, self).setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = u"/organizations/{}/performance/?{}".format(
            self.org.slug,
            urlencode(
                {
                    "view": "TRENDS",
                    "query": "transaction.duration:>0",
                    "statsPeriod": "1h",
                    "project": self.project.id,
                }
            ),
        )

        self.page = BasePage(self.browser)

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):
        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        base_event = load_data("transaction", timestamp=before_now(minutes=0))
        make_trend(self.store_event, self.project.id, base_event, "improvement", 2, 1)
        make_trend(self.store_event, self.project.id, base_event, "regression", 1, 3)

        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()
            trend_item = '[data-test-id="trends-list-item-regression"]'
            self.browser.wait_until(trend_item)
            self.browser.snapshot("performance trends - with data")
