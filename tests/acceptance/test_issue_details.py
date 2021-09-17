from datetime import datetime, timedelta

import pytz
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.compat.mock import patch
from sentry.utils.samples import load_data
from tests.acceptance.page_objects.issue_details import IssueDetailsPage

now = datetime.utcnow().replace(tzinfo=pytz.utc)


class IssueDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        patcher = patch("django.utils.timezone.now", return_value=now)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    def create_sample_event(self, platform, default=None, sample_name=None, time=None):
        event_data = load_data(platform, default=default, sample_name=sample_name)
        event_data["event_id"] = "d964fdbd649a4cf8bfc35d18082b6b0e"

        # Only set these properties if we were given a time.
        # event processing will mark old time values as processing errors.
        if time:
            event_data["received"] = time.isoformat()

        # We need a fallback datetime for the event
        if time is None:
            time = now - timedelta(days=2)
            time = time.replace(hour=0, minute=0, second=0, microsecond=0)

        event_data["timestamp"] = time.isoformat()
        event = self.store_event(
            data=event_data, project_id=self.project.id, assert_no_errors=False
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc), last_seen=time
        )
        return event

    def test_cocoa_event(self):
        event = self.create_sample_event(platform="cocoa")
        for x in range(10):
            self.page.visit_issue(self.org.slug, event.group.id)
            self.browser.snapshot(f"issue details cocoa {x}")
