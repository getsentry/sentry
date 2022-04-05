from .base import BasePage

EDIT_WIDGET_BUTTON = '[data-test-id="widget-edit"]'
WIDGET_DRAG_HANDLE = ".widget-drag"
WIDGET_RESIZE_HANDLE = ".widget-resize"
WIDGET_TITLE_FIELD = 'input[data-test-id="widget-title-input"]'


class DashboardDetailPage(BasePage):
    def __init__(self, browser, client, **kwargs):
        super().__init__(browser)
        self.client = client
        self.organization = kwargs.get("organization", None)
        self.dashboard = kwargs.get("dashboard", None)

    def wait_until_loaded(self):
        self.browser.wait_until_not('[data-test-id="events-request-loading"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')
        self.browser.wait_until_not(".loading")

    def visit_default_overview(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboard/default-overview/")
        self.wait_until_loaded()
        self.browser.driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        self.wait_until_loaded()

    def visit_create_dashboard(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboards/new/")
        self.wait_until_loaded()

    def visit_dashboard_detail(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboard/{self.dashboard.id}/")
        self.wait_until_loaded()

    def enter_edit_state(self):
        self.browser.wait_until_clickable('[data-test-id="dashboard-edit"]')
        button = self.browser.element('[data-test-id="dashboard-edit"]')
        button.click()
        self.wait_until_loaded()

    def click_dashboard_add_widget_button(self):
        self.browser.wait_until_clickable('[data-test-id="widget-add"]')
        button = self.browser.element('[data-test-id="widget-add"]')
        button.click()
        self.wait_until_loaded()

    def click_dashboard_header_add_widget_button(self):
        self.browser.wait_until_clickable('[data-test-id="add-widget-library"]')
        button = self.browser.element('[data-test-id="add-widget-library"]')
        button.click()
        self.wait_until_loaded()

    def click_cancel_button(self):
        self.browser.wait_until_clickable('[data-test-id="dashboard-cancel"]')
        button = self.browser.element('[data-test-id="dashboard-cancel"]')
        button.click()
        self.wait_until_loaded()

    def add_widget_through_dashboard(self, widget_title):
        self.click_dashboard_add_widget_button()
        title_input = self.browser.element(WIDGET_TITLE_FIELD)
        title_input.send_keys(widget_title)
        button = self.browser.element('[data-test-id="add-widget"]')
        button.click()
        self.wait_until_loaded()

    def save_dashboard(self):
        self.browser.wait_until_clickable('[data-test-id="dashboard-commit"]')
        button = self.browser.element('[data-test-id="dashboard-commit"]')
        button.click()
        self.wait_until_loaded()
