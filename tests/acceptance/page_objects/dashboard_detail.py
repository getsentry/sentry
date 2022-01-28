from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .base import BasePage

EDIT_WIDGET_BUTTON = '[data-test-id="widget-edit"]'
WIDGET_DRAG_HANDLE = ".widget-drag"
WIDGET_RESIZE_HANDLE = ".react-resizable-handle"
WIDGET_TITLE_FIELD = 'input[data-test-id="widget-title-input"]'


class DashboardDetailPage(BasePage):
    def __init__(self, browser, client, **kwargs):
        super().__init__(browser)
        self.client = client
        self.organization = kwargs.get("organization", None)
        self.dashboard = kwargs.get("dashboard", None)

    def wait_until_loaded(self):
        WebDriverWait(self.browser.driver, 10).until_not(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".loading-indicator"))
        )
        WebDriverWait(self.browser.driver, 10).until_not(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, '[data-test-id="loading-placeholder"]')
            )
        )

    def visit_default_overview(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboard/default-overview/")
        self.wait_until_loaded()

    def visit_create_dashboard(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboards/new/")
        self.wait_until_loaded()

    def visit_dashboard_detail(self):
        self.browser.get(f"/organizations/{self.organization.slug}/dashboard/{self.dashboard.id}/")
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

    def add_widget_through_dashboard(self, widget_title):
        self.click_dashboard_add_widget_button()
        title_input = self.browser.element(WIDGET_TITLE_FIELD)
        title_input.send_keys(widget_title)
        button = self.browser.element('[data-test-id="add-widget"]')
        button.click()

    def save_dashboard(self):
        button = self.browser.element('[data-test-id="dashboard-commit"]')
        button.click()
