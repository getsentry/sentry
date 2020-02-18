from __future__ import absolute_import

from exam import mock

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase
from tests.acceptance.page_objects.organization_integration_settings import (
    OrganizationIntegrationSettingsPage,
    ExampleIntegrationSetupWindowElement,
)


class OrganizationIntegrationAcceptanceTestCase(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationAcceptanceTestCase, self).setUp()
        self.login_as(self.user)
        self.integration_settings_path = "sentry-api-0-organization-integrations"

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")


class OrganizationIntegrationSettingsTest(OrganizationIntegrationAcceptanceTestCase):
    """
    As a user(type?), I can setup, configure, and remove an integration.
    """

    # TODO(lb): Tests to be written
    # test_setup_new_integration_with_repository
    # test_setup_new_integration_with_issue_sync
    # test_remove_existing_integration_installation
    # test_update_legacy_integration
    # test_user_permissions_for_integration_settings
    # test_add_multiple_integrations_to_one_provider
    # TODO(lb): check issues details page and see that integration shows in linked issues

    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.org_integration_settings_path = u"/settings/{}/integrations/".format(
            self.organization.slug
        )

        self.provider = mock.Mock()
        self.provider.key = "example"
        self.provider.name = "Example Installation"

    def test_can_create_new_integration(self):
        self.load_page(self.org_integration_settings_path)
        org_settings_page = OrganizationIntegrationSettingsPage(browser=self.browser)
        provider_element = org_settings_page.get_provider(self.provider)

        # assert installation rather than upgrade button
        assert provider_element.install_button.text.strip() == "Install"
        assert provider_element.install_button.svg_icon.description("IconAdd")

        integration_details_modal = org_settings_page.click_install_button(provider_element)
        assert integration_details_modal.add_button.label == "Add %s" % self.provider.key
        assert integration_details_modal.title == "%s Integration" % self.provider.key.capitalize()
        integration_details_modal.add_button.click()
        org_settings_page.click_through_integration_setup(
            integration_details_modal,
            ExampleIntegrationSetupWindowElement,
            {"name": self.provider.name},
        )

        # provider_element might be rerendered
        provider_element = org_settings_page.get_provider(self.provider)
        installation_element = provider_element.get_installation_with_name(self.provider.name)
        assert installation_element
        assert Integration.objects.filter(
            provider=self.provider.key, external_id=self.provider.name
        ).exists()
