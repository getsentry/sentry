from __future__ import absolute_import

from exam import mock

from sentry.models import Integration
from sentry.testutils import AcceptanceTestCase
from tests.acceptance.page_objects.organization_integration_settings import (
    ExampleIntegrationSetupWindowElement,
    OrganizationIntegrationDetailViewPage,
)
from sentry.features import OrganizationFeature
from sentry import features


class OrganizationIntegrationDetailView(AcceptanceTestCase):
    """
    As a developer, I can create an integration, install it, and uninstall it
    """

    def setUp(self):
        super(OrganizationIntegrationDetailView, self).setUp()
        features.add("organizations:integrations-feature_flag_integration", OrganizationFeature)
        self.login_as(self.user)

    def load_page(self, slug, configuration_tab=False):
        url = u"/settings/{}/integrations/{}/".format(self.organization.slug, slug)
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    def test_example_installation(self):
        self.provider = mock.Mock()
        self.provider.key = "example"
        self.provider.name = "Example Installation"

        self.load_page("example")
        self.browser.snapshot("integrations - integration detail overview")

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()
        detail_view_page.click_through_integration_setup(
            ExampleIntegrationSetupWindowElement, {"name": self.provider.name}
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

        model.add_organization(self.organization, self.user)
        self.load_page("slack", configuration_tab=True)
        self.browser.snapshot(name="integrations - integration detail one configuration")

        detail_view_page = OrganizationIntegrationDetailViewPage(browser=self.browser)
        assert self.browser.element_exists('[aria-label="Configure"]')
        detail_view_page.uninstall()
        assert not self.browser.element_exists('[aria-label="Configure"]')
        self.browser.snapshot(name="integrations - integration detail no configurations")
