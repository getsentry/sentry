from __future__ import absolute_import

from exam import mock


from sentry.testutils import AcceptanceTestCase

# from tests.acceptance.page_objects.organization_integration_settings import (
#     OrganizationIntegrationSettingsPage,
# )


class OrganizationSentryAppAcceptanceTestCase(AcceptanceTestCase):
    """
    As a user, I can install and uninstall a Sentry App
    """

    def setUp(self):
        super(OrganizationSentryAppAcceptanceTestCase, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Tesla", owner=None)
        self.team = self.create_team(organization=self.org, name="Tesla Motors")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Model S")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.sentry_app = self.create_sentry_app(
            name="Tesla App", published=True, organization=self.org
        )

        self.login_as(self.user)

        self.org_integration_settings_path = u"/settings/{}/integrations/".format(self.org.slug)

        self.provider = mock.Mock()
        self.provider.key = "tesla-app"
        self.provider.name = "Tesla App"

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    # def test_install_sentry_app(self):
    #     self.load_page(self.org_integration_settings_path)

    #     org_settings_page = OrganizationIntegrationSettingsPage(browser=self.browser)

    #     provider_element = org_settings_page.get_provider(self.provider)

    #     # assert installation rather than upgrade button
    #     assert provider_element.install_button.label == "Install"

    #     provider_element.install_button.click()

    #     install_selecter = '.modal-dialog [aria-label="Accept & Install"]'
    #     self.browser.wait_until(install_selecter)
    #     self.browser.click(install_selecter)

    #     self.browser.wait_until(".ref-success")

    #     # provider_element might be rerendered
    #     provider_element = org_settings_page.get_provider(self.provider)

    #     # assert we see the uninstall option
    #     assert provider_element.install_button.label == "Uninstall"

    # def test_uninstall_sentry_app(self):
    #     # add the installation
    #     self.installation = self.create_sentry_app_installation(
    #         slug=self.sentry_app.slug, organization=self.org, user=self.user
    #     )

    #     self.load_page(self.org_integration_settings_path)

    #     org_settings_page = OrganizationIntegrationSettingsPage(browser=self.browser)

    #     provider_element = org_settings_page.get_provider(self.provider)

    #     # assert we see the uninstall option
    #     assert provider_element.install_button.label == "Uninstall"

    #     provider_element.install_button.click()
    #     self.browser.wait_until(org_settings_page.modal_selector)

    #     self.browser.click('.modal-dialog [aria-label="Confirm"]')

    #     self.browser.wait_until(".ref-success")

    #     # provider_element might be rerendered
    #     provider_element = org_settings_page.get_provider(self.provider)

    #     # assert we see the install option now
    #     assert provider_element.install_button.label == "Install"
