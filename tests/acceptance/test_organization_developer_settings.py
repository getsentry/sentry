from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationDeveloperSettingsAcceptanceTest(AcceptanceTestCase):
    """
    As a developer, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super(OrganizationDeveloperSettingsAcceptanceTest, self).setUp()
        self.login_as(self.user)
        self.org_developer_settings_path = u'/settings/{}/developer-settings/'.format(
            self.organization.slug)

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not('.loading-indicator')

    def test_create_new_integration(self):
        with self.feature('organizations:sentry-apps'):
            self.load_page(self.org_developer_settings_path)

            self.browser.click('[aria-label="Create New Integration"]')

            self.browser.element('input[name="name"]').send_keys('Tesla')
            self.browser.element('input[name="author"]').send_keys('Elon Musk')
            self.browser.element('input[name="webhookUrl"]').send_keys(
                'https://example.com/webhook')

            self.browser.click('[aria-label="Save Changes"]')

            self.browser.wait_until('.ref-success')

            assert self.browser.find_element_by_link_text('Tesla')
