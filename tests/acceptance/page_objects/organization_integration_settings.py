from __future__ import absolute_import
from .base import BaseElement, BasePage, ButtonElement, ButtonWithIconElement, ModalElement


class IntegrationProviderRowElement(BaseElement):
    integration_name_selector = '[data-test-id="integration-name"]'

    def __init__(self, provider, *args, **kwargs):
        super(IntegrationProviderRowElement, self).__init__(*args, **kwargs)
        self.provider = provider

        self.install_button = ButtonWithIconElement(
            element=self.element.find_element_by_css_selector('[role="button"]')
        )

    @classmethod
    def get_selector(cls, provider_key):
        return '[data-test-id="%s"]' % provider_key

    @property
    def installations(self):
        return self.element.find_elements_by_css_selector(self.integration_name_selector)

    def get_installation_with_name(self, name):
        for installation in self.installations:
            if installation.get_attribute("innerText") == name:
                return installation
        return None


class InstallationElement(BaseElement):
    configure_button_selector = '[data-test-id="integration-configure-button"]'
    remove_button_selector = '[data-test-id="integration-remove-button"]'

    def __init__(self, integration, *args, **kwargs):
        super(InstallationElement, self).__init__(*args, **kwargs)
        self.integration = integration
        self.configure_button = ButtonWithIconElement(
            element=self.element.find_element_by_css_selector(self.configure_button_selector)
        )
        self.remove_button = ButtonWithIconElement(
            element=self.element.find_element_by_css_selector(self.remove_button_selector)
        )


class IntegrationDetailsModal(ModalElement):
    title_selector = '[data-test-id="provider-name"]'
    cancel_button_selector = '[data-test-id="cancel-button"]'
    add_button_selector = '[data-test-id="add-button"]'

    def __init__(self, provider, *args, **kwargs):
        super(IntegrationDetailsModal, self).__init__(*args, **kwargs)
        self.cancel_button = ButtonElement(
            element=self.element.find_element_by_css_selector(self.cancel_button_selector)
        )
        self.add_button = ButtonElement(
            element=self.element.find_element_by_css_selector(self.add_button_selector)
        )
        self.provider = provider

    @property
    def title(self):
        return self.element.find_element_by_css_selector(self.title_selector).get_attribute(
            "innerText"
        )


class IntegrationSetupWindowElement(ModalElement):
    title_selector = ""

    def fill_in_setup_form(self, installation_data):
        pass


class ExampleIntegrationSetupWindowElement(IntegrationSetupWindowElement):
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


class OrganizationIntegrationSettingsPage(BasePage):
    modal_selector = ".modal-dialog"

    def __init__(self, providers=None, *args, **kwargs):
        super(OrganizationIntegrationSettingsPage, self).__init__(*args, **kwargs)

    def get_provider(self, provider):
        selector = IntegrationProviderRowElement.get_selector(provider.key)
        return IntegrationProviderRowElement(
            provider=provider, element=self.browser.find_element_by_css_selector(selector)
        )

    def click_install_button(self, provider_element):
        provider_element.install_button.click()
        self.browser.wait_until(self.modal_selector)
        integration_details_modal = IntegrationDetailsModal(
            provider=provider_element.provider, element=self.browser
        )
        return integration_details_modal

    def click_through_integration_setup(
        self, integration_details_modal, setup_window_cls, installation_data
    ):
        self.driver.switch_to_window(self.driver.window_handles[1])
        integration_setup_window = setup_window_cls(element=self.browser)
        integration_setup_window.fill_in_setup_form(installation_data)
        integration_setup_window.continue_button.click()
        self.driver.switch_to_window(self.driver.window_handles[0])
