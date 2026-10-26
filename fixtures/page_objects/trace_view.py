from selenium.webdriver.common.by import By

from .base import BasePage
from .global_selection import GlobalSelectionPage


class TraceViewWaterfallPage(BasePage):
    def __init__(self, browser, client):
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_trace_view(self, org, trace_id):
        self.browser.get(f"/organizations/{org}/traces/trace/{trace_id}/")
        self.wait_until_loaded()

    def get_trace_span_row(self, op, description):
        xpath = (
            f'//div[contains(@class, "TraceLeftColumnInner") and '
            f'contains(normalize-space(), "{op} — {description}")]'
        )
        self.browser.wait_until(xpath=xpath)
        return self.browser.find_element(by=By.XPATH, value=xpath)

    def expand_trace_rows(self):
        self.browser.wait_until_clickable(selector=".TraceChildrenCount")
        self.browser.find_element(by=By.CSS_SELECTOR, value=".TraceChildrenCount").click()

    def wait_until_loaded(self):
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def normalize_span_row_text(self, text):
        # Remove newlines and extra spaces
        return text.replace("\n", " ").replace("—", "-").strip()
