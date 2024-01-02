from selenium.webdriver.common.by import By

from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationDeveloperSettingsNewAcceptanceTest(AcceptanceTestCase):
    """
    As a developer, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super().setUp()
        self.team = self.create_team(organization=self.organization, name="Tesla Motors")
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Model S"
        )

        self.login_as(self.user)
        self.org_developer_settings_path = f"/settings/{self.organization.slug}/developer-settings/"

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_create_new_public_integration(self):
        self.load_page(self.org_developer_settings_path)
        self.browser.click('[aria-label="Create New Integration"]')

        self.browser.click_when_visible('[data-test-id="public-integration"]')
        self.browser.click('[aria-label="Next"]')
        self.browser.element('input[name="name"]').send_keys("Tesla")
        self.browser.element('input[name="author"]').send_keys("Elon Musk")
        self.browser.element('input[name="webhookUrl"]').send_keys("https://example.com/webhook")

        self.browser.click('[aria-label="Save Changes"]')

        self.browser.wait_until(xpath="//span[contains(text(), 'Client ID')]", timeout=3)

    def test_create_new_internal_integration(self):
        self.load_page(self.org_developer_settings_path)
        self.browser.click('[aria-label="Create New Integration"]')

        self.browser.click_when_visible('[data-test-id="internal-integration"]')
        self.browser.click('[aria-label="Next"]')

        self.browser.element('input[name="name"]').send_keys("Tesla")

        self.browser.click('[aria-label="Save Changes"]')

        self.browser.wait_until(xpath="//button//span[contains(text(), 'New Token')]", timeout=3)


@no_silo_test
class OrganizationDeveloperSettingsEditAcceptanceTest(AcceptanceTestCase):
    """
    As a developer, I can edit an existing integration
    """

    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Tesla", owner=self.user)
        self.team = self.create_team(organization=self.org, name="Tesla Motors")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Model S")
        self.sentry_app = self.create_sentry_app(
            name="Tesla App",
            organization=self.org,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.login_as(self.user)

        self.org_developer_settings_path = (
            f"/settings/{self.org.slug}/developer-settings/{self.sentry_app.slug}"
        )

    def load_page(self, url):
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_edit_integration_schema(self):
        self.load_page(self.org_developer_settings_path)

        textarea = self.browser.element('textarea[name="schema"]')
        textarea.clear()
        textarea.send_keys("{}")

        self.browser.click('[aria-label="Save Changes"]')

        self.browser.wait_until(".ref-success")

        self.browser.wait_until('[data-test-id="tesla-app"]')

        link = self.browser.find_element(by=By.LINK_TEXT, value="Tesla App")
        link.click()

        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

        schema = self.browser.element('textarea[name="schema"]')
        assert schema.text == ""

    def test_remove_tokens_internal_app(self):
        internal_app = self.create_internal_integration(name="Internal App", organization=self.org)
        url = f"/settings/{self.org.slug}/developer-settings/{internal_app.slug}"

        self.load_page(url)

        self.browser.click('[data-test-id="token-delete"]')
        self.browser.wait_until(".ref-success")

        assert self.browser.find_element(
            by=By.XPATH, value="//div[contains(text(), 'No tokens created yet.')]"
        )

    def test_add_tokens_internal_app(self):
        internal_app = self.create_internal_integration(name="Internal App", organization=self.org)
        url = f"/settings/{self.org.slug}/developer-settings/{internal_app.slug}"

        self.load_page(url)

        self.browser.click('[data-test-id="token-add"]')
        self.browser.wait_until(".ref-success")

        assert len(self.browser.elements('[data-test-id="token-delete"]')) == 2
