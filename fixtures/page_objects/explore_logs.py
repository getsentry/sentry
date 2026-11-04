from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement

from sentry.testutils.pytest.selenium import Browser

from .base import BasePage
from .global_selection import GlobalSelectionPage


class ExploreLogsPage(BasePage):
    def __init__(self, browser: Browser, client: object) -> None:
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_explore_logs(self, org: str) -> None:
        self.browser.get(f"/organizations/{org}/explore/logs/")
        self.wait_until_loaded()

    def toggle_log_row_with_message(self, message: str) -> WebElement:
        row = self.get_log_row_with_message(message)
        try:
            expanded_count = len(
                self.browser.find_elements(By.CSS_SELECTOR, '*[data-test-id="fields-tree"]')
            )
        except Exception:
            expanded_count = 0
        if expanded_count > 0:
            row.click()
            # If this is breaking make sure to only have one row expanded at a time.
            # TODO: Target the correct field-tree with xpath.
            self.browser.wait_until_not('[data-test-id="fields-tree"]')
        else:
            row.click()
            self.browser.wait_until('[data-test-id="fields-tree"]')

        return row

    def get_log_row_with_message(self, message: str) -> WebElement:
        row = self.browser.find_element(
            by=By.XPATH,
            value=f'//*[@data-test-id="log-table-row" and .//*[contains(text(),"{message}")]]',
        )
        return row

    def get_log_row_columns(self, row: WebElement) -> list[WebElement]:
        # The expanded row actually makes a new sibling row that contains the fields-tree.
        columns = row.find_elements(
            By.XPATH, 'following-sibling::*[1]//*[@data-test-id="attribute-tree-column"]'
        )
        return columns

    def wait_until_loaded(self) -> None:
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("logs-table")
