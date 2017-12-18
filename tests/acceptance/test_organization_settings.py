from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationSettingsTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)
        self.path = '/organizations/{}/settings/'.format(self.org.slug)

    def test_simple(self):
        self.browser.get(self.path)
        self.browser.wait_until('.organization-home')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('organization settings')
        assert self.browser.element_exists('.ref-organization-settings')

    def test_renders_2FA_setting_for_admin(self):
        user_owner = self.create_user('owner@example.com')
        # user_admin = self.create_user('admin@gexample.com')
        organization = self.create_organization(name="Example", owner=user_owner)
        # admin_member = self.create_member(
        #    organization=organization,
        #    user=user_admin,
        #    role='admin')

        self.login_as(user_owner)
        path = '/organizations/%s/settings/' % organization.slug
        import pdb
        pdb.set_trace()
        self.browser.get(path)
        self.browser.wait_until('.organization-home')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('organization settings')
        assert self.browser.element_exists('.ref-organization-settings')
        assert self.browser.element_exists('#id-')
