from selenium.webdriver.common.by import By

from .base import BasePage
from .global_selection import GlobalSelectionPage


class ExploreSpansPage(BasePage):
    def __init__(self, browser, client):
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_explore_spans(self, org):
        self.browser.get(f"/organizations/{org}/explore/traces/")
        self.wait_until_loaded()

    def get_spans_row_with_id(self, span_id):
        row = self.browser.find_element(
            by=By.XPATH,
            value=f'//tr[.//*[contains(text(),"{span_id}")]]',
        )
        return row

    def get_spans_row_columns(self, row):
        # The expanded row actually makes a new sibling row that contains the fields-tree.
        columns = row.find_elements(By.XPATH, "child::td")
        return columns

    def wait_until_loaded(self):
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("spans-table")
