from __future__ import absolute_import
from .base import BaseElement, BasePage, ButtonElement, ModalElement, TableElement


class IntegrationProvidersTableElement(TableElement):
    def __init__(self, providers):
        self.providers = providers
        self.rows = self.create_rows()

    def create_rows(self):
        self.rows = [
            IntegrationProviderRowElement(provider=provider)
            for provider in self.providers
        ]

    def assert_integration_provider_visible(self, provider_key):
        assert self.get_integration_provider(provider_key)

    def assert_integration_installation_visible(self, provider_key, installation_name):
        assert self.get_integration_installation(provider_key, installation_name)


class IntegrationProviderRowElement(BaseElement):
    integration_name_selector = '[data-testid="integration-name"]'

    def __init__(self, provider, *args, **kwargs):
        super(IntegrationProviderRowElement, self).__init__(
            selector=self.get_selector(provider.key),
            *args, **kwargs
        )
        self.provider = provider

        button_selector = '[role="button"]'
        self.install_button = ButtonElement(
            selector=button_selector,
            element=self.element.find_element_by_css_selector(button_selector)
        )

    @classmethod
    def get_selector(cls, provider_key):
        return '[data-testid="%s"]' % provider_key

    def assert_installation_added(self, installation_data):
        installation = self.element.find_elements_by_css_selector(
            self.integration_name_selector)[-1]
        assert installation.get_attribute("innerText") == installation_data['name']
        return installation

    def assert_appearance(self, *args, **kwargs):
        # TODO(lb): assert provider name at least
        self.install_button.assert_appearance(
            label='Install',
            is_disabled=False,
            icon='#icon-circle-add'
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

    def assert_title(self, provider_name):
        title = self.element.find_element_by_css_selector(self.title_selector)
        assert title.get_attribute("innerText") == '%s Integration' % provider_name

    def assert_appearance(self, *args, **kwargs):
        self.cancel_button.assert_appearance(label='Cancel')
        self.add_button.assert_appearance(label='Add %s' % self.provider.key)
        self.assert_title(self.provider.key.title())


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

    def assert_appearance(self):
        assert self.continue_button.element.get_attribute('value') == 'Continue'


class OrganizationIntegrationSettingsPage(BasePage):
    page_name = 'organization-integration-settings'
    modal_selector = '.modal-dialog'

    def __init__(self, providers=None, *args, **kwargs):
        super(OrganizationIntegrationSettingsPage, self).__init__(*args, **kwargs)
        self.create_providers(providers)

    def create_providers(self, providers):
        # TODO(lb): Doesn't use providers table above
        self.providers = []
        for provider in providers:
            selector = IntegrationProviderRowElement.get_selector(provider.key)
            element = self.browser.find_element_by_css_selector(selector)
            self.providers.append(
                IntegrationProviderRowElement(
                    provider=provider,
                    element=element,
                )
            )

    def assert_correct_page(self):
        url = self.driver.current_url
        assert 'settings' in url
        assert 'integrations' in url

    def create_new_installation(self, provider_key, installation_data):
        provider_element = [p for p in self.providers if p.provider.key == provider_key][0]
        provider_element.assert_appearance()
        provider_element.install_button.click()

        self.browser.wait_until(self.modal_selector)
        integration_details_modal = IntegrationDetailsModal(
            selector=self.modal_selector,
            provider=provider_element.provider,
            element=self.browser,
        )
        integration_details_modal.assert_appearance()
        integration_details_modal.add_button.click()

        self.driver.switch_to_window(self.driver.window_handles[1])
        integration_setup_window = ExampleIntegrationSetupWindowElement(
            element=self.browser, selector=None,
        )
        integration_setup_window.assert_appearance()
        integration_setup_window.fill_in_setup_form(installation_data)
        integration_setup_window.continue_button.click()

        self.driver.switch_to_window(self.driver.window_handles[0])
        installation = provider_element.assert_installation_added(installation_data)
        return installation
