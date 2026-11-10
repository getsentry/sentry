from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement

from sentry.testutils.pytest.selenium import Browser

from .base import BasePage
from .global_selection import GlobalSelectionPage


class ExploreSpansPage(BasePage):
    def __init__(self, browser: Browser, client: object) -> None:
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_explore_spans(self, org: str) -> None:
        self.browser.get(f"/organizations/{org}/explore/traces/")
        self.wait_until_loaded()

    def get_spans_row_with_id(self, span_id: str) -> WebElement:
        row = self.browser.find_element(
            by=By.XPATH,
            value=f'//tr[.//*[contains(text(),"{span_id}")]]',
        )
        return row

    def click_on_span_id(self, span_id: str) -> None:
        row = self.get_spans_row_with_id(span_id)
        column_objects = self.get_spans_row_columns(row)

        for column in column_objects:
            if column.text == span_id:
                column.click()
                return

        raise Exception(f"Could not find a column with span_id '{span_id}' to click.")

    def get_spans_row_columns(self, row: WebElement) -> list[WebElement]:
        # The expanded row actually makes a new sibling row that contains the fields-tree.
        columns = row.find_elements(By.XPATH, "child::td")
        return columns

    def wait_until_loaded(self) -> None:
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("spans-table")
