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
        self.path = '/organizations/{}/settings/'.format(self.org.slug)

    def load_organization_helper(self, snapshot_name):
        self.browser.wait_until('.organization-home')
        self.browser.wait_until_not('.loading-indicator')
        self.browser.snapshot('organization settings -- ' + snapshot_name)
        assert self.browser.element_exists('.ref-organization-settings')

    def renders_2fa_setting(self):
        return self.browser.element_exists('#id-require2FA')

    def test_simple(self):
        self.browser.get(self.path)
        self.load_organization_helper("Simple")

    def test_disabled_2fa_feature(self):
        user_owner = self.create_user('owner@example.com')
        organization = self.create_organization(name="Example", owner=user_owner)
        self.login_as(user_owner)
        path = '/organizations/%s/settings/' % organization.slug

        self.browser.get(path)
        self.load_organization_helper("disabled 2fa feature")
        assert not self.renders_2fa_setting()

    def test_renders_2fa_setting_for_owner(self):
        user_owner = self.create_user('owner@example.com')
        organization = self.create_organization(name="Example", owner=user_owner)
        self.login_as(user_owner)
        path = '/organizations/%s/settings/' % organization.slug

        with self.feature('organizations:require-2fa'):
            self.browser.get(path)
            self.load_organization_helper("renders 2fa setting for organization owner")
            assert self.renders_2fa_setting()

    def test_renders_2fa_setting_for_manager(self):
        user_manager = self.create_user('manager@gexample.com')
        organization = self.create_organization(
            name="Example", owner=self.create_user('owner@example.com'))
        self.create_member(organization=organization, user=user_manager, role='manager')
        self.login_as(user_manager)
        path = '/organizations/%s/settings/' % organization.slug

        with self.feature('organizations:require-2fa'):
            self.browser.get(path)
            self.load_organization_helper("renders 2fa setting for organization manager")
            assert self.renders_2fa_setting()

    def test_setting_2fa_without_2fa_enabled(self):
        user_owner = self.create_user('owner@example.com')
        organization = self.create_organization(name="Example", owner=user_owner)
        self.login_as(user_owner)
        path = '/organizations/%s/settings/' % organization.slug

        with self.feature('organizations:require-2fa'):
            self.browser.get(path)
            self.browser.wait_until_not('.loading-indicator')
            assert not self.browser.element_exists('.ref-organization-settings .error')
            self.browser.click('#id-require2FA')
            self.browser.click('.ref-organization-settings button.btn.btn-primary')
            self.load_organization_helper("setting 2fa without 2fa enabled")
            assert self.browser.element_exists('.ref-organization-settings .error')
