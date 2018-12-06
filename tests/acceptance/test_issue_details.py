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

    def create_sample_event(self, platform, default=None, sample_name=None):
        event = create_sample_event(
            project=self.project,
            platform=platform,
            default=default,
            sample_name=sample_name,
            event_id='d964fdbd649a4cf8bfc35d18082b6b0e'
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
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details python')

    def test_cocoa_event(self):
        event = self.create_sample_event(
            platform='cocoa',
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details cocoa')

    def test_unity_event(self):
        event = self.create_sample_event(
            default='unity',
            platform='csharp'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details unity')

    def test_aspnetcore_event(self):
        event = self.create_sample_event(
            default='aspnetcore',
            platform='csharp'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details aspnetcore')

    def test_javascript_specific_event(self):
        event = self.create_sample_event(
            platform='javascript'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/events/{}/'.format(self.org.slug,
                                                  self.project.slug, event.group.id, event.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details javascript - event details')

    def test_rust_event(self):
        # TODO: This should become its own "rust" platform type
        event = self.create_sample_event(
            platform='native',
            sample_name='Rust',
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details rust')

    def test_cordova_event(self):
        event = self.create_sample_event(
            platform='cordova'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details cordova')

    def test_stripped_event(self):
        event = self.create_sample_event(
            platform='pii'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details pii stripped')

    def test_empty_exception(self):
        event = self.create_sample_event(
            platform='empty-exception'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details empty exception')

    def test_empty_stacktrace(self):
        event = self.create_sample_event(
            platform='empty-stacktrace'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.snapshot('issue details empty stacktrace')

    def test_invalid_interfaces(self):
        event = self.create_sample_event(
            platform='invalid-interfaces'
        )

        self.browser.get(
            u'/{}/{}/issues/{}/'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.wait_until_loaded()
        self.browser.click('.errors-toggle')
        self.browser.wait_until('.entries > .errors ul')
        self.browser.snapshot('issue details invalid interfaces')

    def test_activity_page(self):
        event = self.create_sample_event(
            platform='python',
        )

        self.browser.get(
            u'/{}/{}/issues/{}/activity'.format(self.org.slug, self.project.slug, event.group.id)
        )
        self.browser.wait_until('.activity-item')
        self.browser.snapshot('issue activity python')

    def wait_until_loaded(self):
        self.browser.wait_until('.entries')
        self.browser.wait_until('[data-test-id="linked-issues"]')
        self.browser.wait_until('[data-test-id="loaded-device-name"]')
        self.browser.wait_until_not('.loading-indicator')
