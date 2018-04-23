from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.models import GroupAssignee
from sentry.utils.samples import create_sample_event
from datetime import datetime


class DashboardTest(AcceptanceTestCase):
    def setUp(self):
        super(DashboardTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.path = '/{}/'.format(self.org.slug)

    def test_no_issues(self):
        self.project.update(first_event=None)
        self.browser.get(self.path)
        # dashboard is a bit complex to load since it has many subcomponents
        # so we bank on a few containers being enough of a check
        self.browser.wait_until('.organization-home')
        self.browser.wait_until('.dashboard-barchart')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.wait_until('.awaiting-events')
        self.browser.snapshot('org dash no issues')

    def test_one_issue(self):
        event = create_sample_event(
            project=self.project,
            platform='python',
            event_id='d964fdbd649a4cf8bfc35d18082b6b0e',
            timestamp=1452683305,
        )
        event.group.update(
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2018, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        GroupAssignee.objects.create(
            user=self.user,
            group=event.group,
            project=self.project,
        )
        self.project.update(first_event=timezone.now())
        self.browser.get(self.path)
        # dashboard is a bit complex to load since it has many subcomponents
        # so we bank on the core container and the activity container being
        # enough of a check
        self.browser.wait_until('.organization-home')
        self.browser.wait_until('.dashboard-barchart')
        self.browser.wait_until_not('.loading-indicator')
        assert not self.browser.element_exists('.awaiting-events')
        self.browser.snapshot('org dash one issue')

    def test_new_dashboard(self):
        with self.feature('organizations:dashboard'):
            self.browser.get(self.path)
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('new dashboard')
