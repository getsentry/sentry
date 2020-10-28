from __future__ import absolute_import
from .base import BasePage, ButtonElement, ModalElement


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


class OrganizationAbstractDetailViewPage(BasePage):
    configurations_text = "Configurations"

    def click_install_button(self):
        self.browser.click('[data-test-id="install-button"]')

    # uninstalls any configuration (not a particular one)
    def uninstall(self):
        self.browser.click('[aria-label="Uninstall"]')
        self.browser.click('[data-test-id="confirm-button"]')

    def switch_to_configuration_view(self):
        self.browser.find_element_by_link_text(self.configurations_text).click()


class OrganizationIntegrationDetailViewPage(OrganizationAbstractDetailViewPage):
    def click_through_integration_setup(self, setup_window_cls, installation_data):
        self.driver.switch_to_window(self.driver.window_handles[1])
        integration_setup_window = setup_window_cls(element=self.browser)
        integration_setup_window.fill_in_setup_form(installation_data)
        integration_setup_window.continue_button.click()
        self.driver.switch_to_window(self.driver.window_handles[0])


class OrganizationSentryAppDetailViewPage(OrganizationAbstractDetailViewPage):
    def uninstall(self):
        self.browser.click('[data-test-id="sentry-app-uninstall"]')
        self.browser.click('[data-test-id="confirm-button"]')
