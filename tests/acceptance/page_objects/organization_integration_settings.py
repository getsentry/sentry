from __future__ import absolute_import
from .base import BaseElement, BasePage, ButtonElement, ButtonWithIconElement, ModalElement


class IntegrationProviderRowElement(BaseElement):
    integration_name_selector = '[data-testid="integration-name"]'

    def __init__(self, provider, *args, **kwargs):
        super(IntegrationProviderRowElement, self).__init__(
            selector=self.get_selector(provider.key),
            *args, **kwargs
        )
        self.provider = provider

        button_selector = '[role="button"]'
        self.install_button = ButtonWithIconElement(
            selector=button_selector,
            element=self.element.find_element_by_css_selector(button_selector)
        )

    @classmethod
    def get_selector(cls, provider_key):
        return '[data-testid="%s"]' % provider_key

    def get_installations(self):
        return self.element.find_elements_by_css_selector(
            self.integration_name_selector
        )

    def get_installation_with_name(self, name):
        for installation in self.get_installations():
            if installation.get_attribute("innerText") == name:
                return installation
        return None


class InstallationElement(BaseElement):
    configure_button_selector = '[data-testid="integration-configure-button"]'
    remove_button_selector = '[data-testid="integration-configure-button"]'

    def __init__(self, integration, *args, **kwargs):
        super(InstallationElement, self).__init__(
            selector='[data-testid="%s"]' % integration.id,
            *args, **kwargs
        )
        self.integration = integration
        self.configure_button = ButtonWithIconElement(
            selector=self.configure_button_selector,
            element=self.element.find_element_by_css_selector(self.configure_button_selector),
        )
        self.remove_button = ButtonWithIconElement(
            selector=self.remove_button_selector,
            element=self.element.find_element_by_css_selector(self.remove_button_selector)
        )


class IntegrationDetailsModal(ModalElement):
    title_selector = '[data-testid="provider-name"]'
    cancel_button_selector = '[data-testid="cancel-button"]'
    add_button_selector = '[data-testid="add-button"]'

    def __init__(self, provider, *args, **kwargs):
        super(IntegrationDetailsModal, self).__init__(*args, **kwargs)
        self.cancel_button = ButtonElement(
            selector=self.cancel_button_selector,
            element=self.element.find_element_by_css_selector(self.cancel_button_selector),
        )
        self.add_button = ButtonElement(
            selector=self.add_button_selector,
            element=self.element.find_element_by_css_selector(self.add_button_selector),
        )
        self.provider = provider

    @property
    def title(self):
        return self.element.find_element_by_css_selector(
            self.title_selector).get_attribute("innerText")


class IntegrationSetupWindowElement(ModalElement):
    title_selector = ''

    def fill_in_setup_form(self, installation_data):
        pass


class ExampleIntegrationSetupWindowElement(IntegrationSetupWindowElement):
    name_field_selector = 'name'
    submit_button_selector = '[type="submit"]'

    def __init__(self, *args, **kwargs):
        super(ExampleIntegrationSetupWindowElement, self).__init__(*args, **kwargs)
        self.name = self.element.find_element_by_name('name')
        continue_button_element = self.element.find_element_by_css_selector(
            self.submit_button_selector)
        self.continue_button = ButtonElement(self.submit_button_selector, continue_button_element)

    def fill_in_setup_form(self, installation_data):
        self.name.send_keys(installation_data['name'])


class OrganizationIntegrationSettingsPage(BasePage):
    page_name = 'organization-integration-settings'
    modal_selector = '.modal-dialog'

    def __init__(self, providers=None, *args, **kwargs):
        super(OrganizationIntegrationSettingsPage, self).__init__(*args, **kwargs)

    def assert_correct_page(self):
        url = self.driver.current_url
        assert 'settings' in url
        assert 'integrations' in url

    def get_provider(self, provider):
        selector = IntegrationProviderRowElement.get_selector(provider.key)
        return IntegrationProviderRowElement(
            provider=provider,
            element=self.browser.find_element_by_css_selector(selector),
        )

    def click_install_button(self, provider_element):
        provider_element.install_button.click()
        self.browser.wait_until(self.modal_selector)
        integration_details_modal = IntegrationDetailsModal(
            selector=self.modal_selector,
            provider=provider_element.provider,
            element=self.browser,
        )
        return integration_details_modal

    def click_through_integration_setup(
            self, integration_details_modal, setup_window_cls, installation_data):
        self.driver.switch_to_window(self.driver.window_handles[1])
        integration_setup_window = setup_window_cls(element=self.browser, selector=None)
        integration_setup_window.fill_in_setup_form(installation_data)
        integration_setup_window.continue_button.click()
        self.driver.switch_to_window(self.driver.window_handles[0])
