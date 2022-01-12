from .base import BasePage


class DashboardDetailPage(BasePage):
    def __init__(self, browser, client, organization):
        super().__init__(browser)
        self.client = client
        self.organization = organization

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def visit_default_overview(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboard/default-overview/")
        self.wait_until_loaded()

    def visit_create_dashboard(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboards/new/")
        self.wait_until_loaded()

    def enter_edit_state(self):
        button = self.browser.element('[data-test-id="dashboard-edit"]')
        button.click()

    def click_dashboard_add_widget_button(self):
        button = self.browser.element('[data-test-id="widget-add"]')
        button.click()

    def click_dashboard_header_add_widget_button(self):
        button = self.browser.element('[data-test-id="add-widget-library"]')
        button.click()
