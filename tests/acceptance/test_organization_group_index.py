from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase


class OrganizationGroupIndexTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationGroupIndexTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(owner=self.user, name='Rowdy Tiger')
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

    def test_with_onboarding(self):
        self.project.update(first_event=None)
        with self.feature(['organizations:sentry10', 'organizations:discover']):
            self.browser.get(self.path)
            self.wait_until_loaded()
            self.browser.wait_until('[data-test-id="awaiting-events"]')
            self.browser.snapshot('organization issues onboarding')

    def test_with_no_results(self):
        self.project.update(first_event=timezone.now())
        with self.feature(['organizations:sentry10', 'organizations:discover']):
            self.browser.get(self.path)
            self.wait_until_loaded()
            self.browser.wait_until('[data-test-id="empty-state"]')
            self.browser.snapshot('organization issues no results')

    def wait_until_loaded(self):
        self.browser.wait_until_not('.loading')
