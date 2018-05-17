from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.utils.samples import create_sample_event


class IssueDetailsTest(AcceptanceTestCase):
    def setUp(self):
        super(IssueDetailsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.login_as(self.user)

    def create_sample_event(self, platform, sample_name=None):
        event = create_sample_event(
            project=self.project,
            platform=platform,
            sample_name=sample_name,
            event_id='d964fdbd649a4cf8bfc35d18082b6b0e',
            timestamp=1452683305,
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc),
            last_seen=datetime(2016, 1, 13, 3, 8, 25, tzinfo=timezone.utc),
        )
        return event

    def test_python_event(self):
        event = self.create_sample_event(
            platform='python',
        )

        self.browser.get(
            '/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.entries')
        self.browser.snapshot('issue details python')

    def test_cocoa_event(self):
        event = self.create_sample_event(
            platform='cocoa',
        )

        self.browser.get(
            '/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.entries')
        self.browser.snapshot('issue details cocoa')

    def test_javascript_specific_event(self):
        event = self.create_sample_event(
            platform='javascript'
        )

        self.browser.get(
            '/{}/{}/issues/{}/events/{}/'.format(self.org.slug, self.project.slug, event.group.id, event.id)
        )
        self.browser.wait_until('.event-details-container')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('issue details javascript - event details')

    def test_rust_event(self):
        # TODO: This should become its own "rust" platform type
        event = self.create_sample_event(
            platform='native',
            sample_name='Rust',
        )

        self.browser.get(
            '/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.entries')
        self.browser.snapshot('issue details rust')

    def test_cordova_event(self):
        event = self.create_sample_event(
            platform='cordova'
        )

        self.browser.get(
            '/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.entries')
        self.browser.snapshot('issue details cordova')

    def test_activity_page(self):
        event = self.create_sample_event(
            platform='python',
        )

        self.browser.get(
            '/{}/{}/issues/{}/activity'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.activity-item')
        self.browser.snapshot('issue activity python')
