from __future__ import absolute_import

import mock

from sentry.models import Project
from sentry.testutils import AcceptanceTestCase


class OrganizationOnboardingTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationOnboardingTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.member = self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

    @mock.patch('sentry.models.ProjectKey.generate_api_key',
                return_value='031667ea1758441f92c7995a428d2d14')
    def test_onboarding(self, generate_api_key):
        self.browser.get('/onboarding/%s/' % self.org.slug)
        self.browser.wait_until('.onboarding-container')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot(name='onboarding-choose-platform')

        self.browser.click('[data-test-id="platform-javascript-angular"]')
        self.browser.click('[data-test-id="create-project"]')

        self.browser.wait_until('.onboarding-Configure')
        self.browser.wait_until_not('.loading-indicator')

        project = Project.objects.get(organization=self.org)
        assert project.name == 'Angular'
        assert project.platform == 'javascript-angular'

        self.browser.snapshot(name='onboarding-configure-project')
        self.browser.click('[data-test-id="configure-done"]')
        self.browser.wait_until_not('.loading-indicator')

        assert self.browser.element_exists('.robot')
        assert self.browser.element_exists_by_test_id('install-instructions')
