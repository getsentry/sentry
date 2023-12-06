from unittest import mock

from fixtures.page_objects.organization_integration_settings import (
    ExampleIntegrationSetupWindowElement,
    OrganizationIntegrationDetailViewPage,
)
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class OrganizationIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def load_page(self, slug, configuration_tab=False):
        url = f"/settings/{self.organization.slug}/integrations/{slug}/"
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_example_installation(self):
        self.provider = mock.Mock()
        self.provider.key = "alert_rule_integration"
        self.provider.name = "Example Installation"

        self.load_page("alert_rule_integration")

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()
        detail_view_page.click_through_integration_setup(
            ExampleIntegrationSetupWindowElement, {"name": self.provider.name}
        )

        self.wait_for_loading()

        integration = Integration.objects.filter(
            provider=self.provider.key, external_id=self.provider.name
        ).first()

        assert integration
        assert (
            f"/settings/{self.organization.slug}/integrations/{self.provider.key}/{integration.id}/"
            in self.browser.driver.current_url
        )

    def test_uninstallation(self):
        model = Integration.objects.create(
            provider="slack",
            external_id="some_slack",
            name="Test Slack",
            metadata={
                "domain_name": "slack-test.slack.com",
                "installation_type": "born_as_bot",
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            },
        )

        model.add_organization(self.organization, self.user)
        self.load_page("slack", configuration_tab=True)

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        assert self.browser.element_exists('[aria-label="Configure"]')
        detail_view_page.uninstall()

        assert (
            self.browser.element('[data-test-id="integration-status"]').text == "Pending Deletion"
        )
