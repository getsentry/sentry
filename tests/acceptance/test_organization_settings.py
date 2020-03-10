from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationSettingsTest(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationSettingsTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.login_as(self.user)
        self.path = u"/organizations/{}/settings/".format(self.org.slug)

    def load_organization_helper(self, snapshot_name=None):
        self.browser.wait_until_not(".loading-indicator")
        if snapshot_name is not None:
            self.browser.snapshot("organization settings -- " + snapshot_name)
        assert self.browser.element_exists('[data-test-id="organization-settings"]')

    def renders_2fa_setting(self):
        return self.browser.element_exists("#require2FA")

    def test_renders_2fa_setting_for_owner(self):
        user_owner = self.create_user("owner@example.com")
        organization = self.create_organization(name="Example", owner=user_owner)
        self.login_as(user_owner)
        path = "/organizations/%s/settings/" % organization.slug

        self.browser.get(path)
        self.load_organization_helper()
        assert self.renders_2fa_setting()

    def test_renders_2fa_setting_for_manager(self):
        user_manager = self.create_user("manager@gexample.com")
        organization = self.create_organization(
            name="Example", owner=self.create_user("owner@example.com")
        )
        self.create_member(organization=organization, user=user_manager, role="manager")
        self.login_as(user_manager)
        path = "/organizations/%s/settings/" % organization.slug

        self.browser.get(path)
        self.load_organization_helper()
        assert self.renders_2fa_setting()

    def test_setting_2fa_without_2fa_enabled(self):
        user_owner = self.create_user("owner@example.com")
        organization = self.create_organization(name="Example", owner=user_owner)
        self.login_as(user_owner)
        path = "/organizations/%s/settings/" % organization.slug

        self.browser.get(path)
        self.browser.wait_until_not(".loading-indicator")
        assert not self.browser.element_exists('[data-test-id="organization-settings"] .error')
        self.browser.click("#require2FA")

        self.browser.wait_until(".modal")
        self.browser.click('.modal [data-test-id="confirm-button"]')
        self.browser.wait_until_not(".modal")
        self.browser.wait_until_test_id("toast-error")
        self.load_organization_helper("setting 2fa without 2fa enabled")
