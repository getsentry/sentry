from functools import cached_property

from fixtures.page_objects.organization_integration_settings import (
    OrganizationAbstractDetailViewPage,
)
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin


@no_silo_test
class OrganizationPluginDetailedView(AcceptanceTestCase):
    @cached_property
    def plugin(self):
        return OpsGeniePlugin()

    def setUp(self):
        super().setUp()
        # need at least two projects
        self.project = self.create_project(organization=self.organization, name="Back end")
        self.create_project(organization=self.organization, name="Front End")
        self.login_as(self.user)

    def load_page(self, slug, configuration_tab=False):
        url = f"/settings/{self.organization.slug}/plugins/{slug}/"
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_opsgenie_add_to_project(self):
        self.load_page("opsgenie")

        detail_view_page = OrganizationAbstractDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()

        self.browser.click('[role="dialog"] [id$="option-0-0"]')
        # check if we got to the configuration page with the form
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("plugin-config")

    def test_uninstallation(self):
        self.plugin.set_option("api_key", "7c8951d1", self.project)
        self.plugin.set_option("alert_url", "https://api.opsgenie.com/v2/alerts", self.project)

        self.load_page("opsgenie", configuration_tab=True)

        detail_view_page = OrganizationAbstractDetailViewPage(browser=self.browser)

        assert self.browser.element_exists('[aria-label="Configure"]')

        detail_view_page.uninstall()
        self.browser.wait_until('[data-test-id="toast-success"]')
        assert not self.browser.element_exists('[aria-label="Configure"]')
