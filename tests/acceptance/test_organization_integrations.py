from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationIntegrationsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationsTest, self).setUp()
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
        self.path = '/organizations/{}/integrations/'.format(self.org.slug)

    def test_simple(self):
        with self.feature('organizations:integrations-v3'):
            self.browser.get(self.path)
            self.browser.wait_until('.organization-home')
            self.browser.wait_until_not('.loading-indicator')
            self.browser.snapshot('organization integrations')
            assert self.browser.element_exists('.ref-organization-integrations')
