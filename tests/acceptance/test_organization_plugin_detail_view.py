from __future__ import absolute_import

from exam import fixture

from sentry.testutils import AcceptanceTestCase
from tests.acceptance.page_objects.organization_integration_settings import (
    OrganizationAbstractDetailViewPage,
)
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin


class OrganizationPluginDetailedView(AcceptanceTestCase):
    @fixture
    def plugin(self):
        return OpsGeniePlugin()

    def setUp(self):
        super(OrganizationPluginDetailedView, self).setUp()
        # need at least two projects
        self.project = self.create_project(organization=self.organization, name="Back end")
        self.create_project(organization=self.organization, name="Front End")
        self.login_as(self.user)

    def load_page(self, slug, configuration_tab=False):
        url = u"/settings/{}/plugins/{}/".format(self.organization.slug, slug)
        if configuration_tab:
            url += "?tab=configurations"
        self.browser.get(url)
        self.browser.wait_until_not(".loading-indicator")

    def test_opsgenie_add_to_project(self):
        self.load_page("opsgenie")
        self.browser.snapshot("integrations - plugin detail overview")

        detail_view_page = OrganizationAbstractDetailViewPage(browser=self.browser)
        detail_view_page.click_install_button()

        self.browser.click('[id="react-select-2-option-0"]')
        # check if we got to the configuration page with the form
        self.browser.wait_until_not(".loading-indicator")
        assert self.browser.element_exists('[id="id-api_key"]')

    def test_uninstallation(self):
        self.plugin.set_option("api_key", "7c8951d1", self.project)
        self.plugin.set_option("alert_url", "https://api.opsgenie.com/v2/alerts", self.project)

        self.load_page("opsgenie", configuration_tab=True)
        self.browser.snapshot("integrations - plugin detail one configuration")

        detail_view_page = OrganizationAbstractDetailViewPage(browser=self.browser)

        assert self.browser.element_exists('[aria-label="Configure"]')
        detail_view_page.uninstall()
        self.browser.wait_until('[data-test-id="toast-success"]')
        assert not self.browser.element_exists('[aria-label="Configure"]')
        self.browser.snapshot("integrations - plugin detail no configurations")
