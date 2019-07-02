from __future__ import absolute_import

from sentry.testutils import AcceptanceTestCase


class OrganizationIntegrationAcceptanceTestCase(AcceptanceTestCase):
    def setUp(self):
        super(OrganizationIntegrationAcceptanceTestCase, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            name='Rowdy Tiger',
            owner=None,
        )
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(
            organization=self.org,
            teams=[self.team],
            name='Bengal',
        )
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.login_as(self.user)

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not('.loading-indicator')


class OrganizationIntegrationSettingsTest(OrganizationIntegrationAcceptanceTestCase):
    """
    As a develop, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super(OrganizationIntegrationSettingsTest, self).setUp()
        self.org_developer_settings_path = u'/settings/{}/developer-settings/'.format(
            self.organization.slug)

    def test_create_new_integration(self):
        with self.feature('organizations:sentry-apps'):

            self.load_page(self.org_developer_settings_path)

            self.browser.click('[aria-label="Create New Integration"]')

            self.browser.element('input[name="name"]').send_keys('Tesla')
            self.browser.element('input[name="author"]').send_keys('Elon Musk')
            self.browser.element('input[name="webhookUrl"]').send_keys('https://tesla.com/webhook')

            self.browser.click('[aria-label="Save Changes"]')

            self.browser.wait_until('.ref-success')

            assert self.browser.find_element_by_link_text('Tesla')
