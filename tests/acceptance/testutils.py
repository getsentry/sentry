from __future__ import absolute_import


class BasePage(object):
    page_name = 'base'

    def __init__(self, browser):
        self.browser = browser
        try:
            self.assert_correct_page()
        except AssertionError:
            raise Exception(
                'This is not the %s page. Current url is %s.' %
                (self.page_name, self.driver.current_url))

    @property
    def driver(self):
        return self.browser.driver

    def assert_correct_page(self):
        raise NotImplementedError

    def get_button(self, selector, label, disabled='false', browser=None):
        browser = self.browser if not browser else browser
        button = browser.find_element_by_css_selector(selector)
        assert button.get_attribute('aria-label') == label
        assert button.get_attribute('aria-disabled') == disabled
        return button


class BaseElement(object):
    def __init__(self):
        pass


class IntegrationProviderElement(BaseElement):
    def __init__(self, provider, installation_data):
        super(IntegrationProviderElement, self).__init__()
        self.provider = provider
        self.installation_data = installation_data

    def handle_integration_setup_window(self):
        raise NotImplementedError

    def assert_installation_added(self):
        raise NotImplementedError


class ExampleProviderElement(IntegrationProviderElement):
    def handle_integration_setup_window(self):
        self.driver.switch_to_window(self.driver.window_handles[1])
        self.driver.find_element_by_name('name').send_keys(self.installation_data['name'])
        continue_button = self.browser.element('[type="submit"]')
        assert continue_button.get_attribute('value') == 'Continue'
        continue_button.click()

    def assert_installation_added(self):
        assert self.browser.element(
            '[data-testid="integration-name"]').get_attribute("innerText") == self.installation_data['name']


class OrganizationIntegrationSettingsPage(BasePage):
    page_name = 'organization-integration-settings'

    def assert_correct_page(self):
        url = self.driver.current_url
        assert 'settings' in url
        assert 'integrations' in url

    def get_integration_provider(self, provider_key):
        return self.browser.element('[data-testid="%s"]' % (provider_key))

    def get_integration_installation(self, provider_key, installation_name):
        pass

    def assert_integration_provider_visible(self, provider_key):
        assert self.get_integration_provider(provider_key)

    def assert_integration_installation_visible(self, provider_key, installation_name):
        assert self.get_integration_installation(provider_key, installation_name)

    def click_add_new_installation(self, provider_key):
        provider_element = self.get_integration_provider(provider_key)
        install_button = self.get_button('[role="button"]', 'Install', browser=provider_element)
        assert install_button.find_element_by_tag_name(
            'use').get_attribute('href') == u'#icon-circle-add'
        install_button.click()

    def click_installation_modal(self, provider):
        self.browser.wait_until('.modal-dialog')
        modal = self.browser.element('.modal-dialog')
        assert modal.find_element_by_css_selector(
            '[data-testid="provider-name"]').get_attribute("innerText") == '%s Integration' % provider.name
        assert self.get_button('[data-testid="cancel-button"]', 'Cancel', browser=modal)
        add_button = self.get_button(
            '[data-testid="add-button"]', 'Add %s' %
            provider.key, browser=modal)
        add_button.click()

    def create_new_installation(self, provider_element):
        self.click_add_new_installation(provider_element.provider)
        self.click_installation_modal(provider_element.provider)
        provider_element.click_integration_setup_window()
        provider_element.assert_installation_added()
