from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase
from sentry.utils.samples import create_sample_event


class OrganizationGroupIndexTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationGroupIndexTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user, name='Rowdy Tiger')
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band',
            members=[self.user])
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.other_project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Sumatra',
        )
        self.login_as(self.user)
        self.path = u'/organizations/{}/issues/'.format(self.org.slug)

    def test_with_issues(self):
        with self.feature(['organizations:sentry10', 'organizations:discover']):
            self.project.update(first_event=timezone.now())
            create_sample_event(
                project=self.project,
                platform='python',
                event_id='d964fdbd649a4cf8bfc35d18082b6b0e')
            create_sample_event(
                project=self.other_project,
                platform='python',
                event_id='d88fbbbd649a4cf8bfc35d18082b6b0e')
            self.browser.get(self.path)
            self.wait_until_loaded()
            self.browser.wait_until('.event-issue-header')
            self.browser.snapshot('organization issues with issues')

    def test_with_onboarding(self):
        self.project.update(first_event=None)
        with self.feature(['organizations:sentry10', 'organizations:discover']):
            self.browser.get(self.path)
            self.wait_until_loaded()
            self.browser.wait_until('[data-test-id="awaiting-events"]')
            self.browser.snapshot('organization issues onboarding')

    def wait_until_loaded(self):
        self.browser.wait_until_not('.loading')
