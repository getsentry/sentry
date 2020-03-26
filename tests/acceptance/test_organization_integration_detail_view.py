from __future__ import absolute_import

from exam import mock

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase

# from tests.acceptance.page_objects.organization_integration_settings import (
#     OrganizationIntegrationDetailViewPage,
#     ExampleIntegrationSetupWindowElement,
# )
from tests.acceptance.page_objects.base import BaseElement, BasePage, ButtonElement, ModalElement


from time import sleep



class ExampleIntegrationSetupWindowElement(ModalElement):
    name_field_selector = "name"
    submit_button_selector = '[type="submit"]'

    def __init__(self, *args, **kwargs):
        super(ExampleIntegrationSetupWindowElement, self).__init__(*args, **kwargs)
        self.name = self.element.find_element_by_name("name")
        continue_button_element = self.element.find_element_by_css_selector(
            self.submit_button_selector
        )
        self.continue_button = ButtonElement(continue_button_element)

    def fill_in_setup_form(self, installation_data):
        self.name.send_keys(installation_data[self.name_field_selector])


class OrganizationIntegrationDetailViewPage(BasePage):
    # def __init__(self, *args, **kwargs):
    #     super(OrganizationIntegrationDetailViewPage, self).__init__(*args, **kwargs)

    def click_install_button(self):
        self.browser.click('[data-test-id="add-button"]')

    def uninstall(self):
        self.browser.click('[aria-label="Uninstall"]')
        self.browser.click('[data-test-id="confirm-button"]')

    def click_through_integration_setup(self, setup_window_cls, installation_data):
        self.driver.switch_to_window(self.driver.window_handles[1])
        integration_setup_window = setup_window_cls(element=self.browser)
        integration_setup_window.fill_in_setup_form(installation_data)
        integration_setup_window.continue_button.click()
        self.driver.switch_to_window(self.driver.window_handles[0])

    def switch_to_configuration_view(self):
        self.browser.find_element_by_link_text('Configurations').click()


class OrganizationIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super(OrganizationIntegrationDetailView, self).setUp()
        self.login_as(self.user)
        self.github_path = u"/settings/{}/integrations/github/".format(
            self.organization.slug
        )

    def load_page(self, slug, configuration_tab=False):
        url = u"/settings/{}/integrations/{}/".format(
            self.organization.slug, slug
        )
        if configuration_tab:
            url += '?tab=configurations'
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")


    def test_example_installation(self):
        self.provider = mock.Mock()
        self.provider.key = "example"
        self.provider.name = "Example Installation"

        self.load_page('example')

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()
        detail_view_page.click_through_integration_setup(
            ExampleIntegrationSetupWindowElement,
            {"name": self.provider.name},
        )

        # provider_element might be rerendered
        assert Integration.objects.filter(
            provider=self.provider.key, external_id=self.provider.name
        ).exists()

        detail_view_page.switch_to_configuration_view()
        assert self.browser.element_exists('[aria-label="Configure"]')


    def test_uninstallation(self):
        model = Integration.objects.create(
            provider="slack",
            external_id="some_slack",
            name="Test Slack",
            metadata={"domain_name": "slack-test.slack.com"},
        )

        print("self", vars(self))

        model.add_organization(self.organization, self.user)
        self.load_page('slack', configuration_tab=True)

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        detail_view_page.uninstall()
