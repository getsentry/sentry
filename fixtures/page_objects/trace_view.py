from typing import Any

from selenium.webdriver.common.by import By

from sentry.testutils.pytest.selenium import Browser

from .base import BasePage
from .global_selection import GlobalSelectionPage


class TraceViewWaterfallPage(BasePage):
    def __init__(self, browser: Browser, client: Any) -> None:
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_trace_view(self, org: str, trace_id: str) -> None:
        self.browser.get(f"/organizations/{org}/traces/trace/{trace_id}/")
        self.wait_until_loaded()

    def get_trace_span_row(self, op: str, description: str) -> Any:
        xpath = (
            f'//div[contains(@class, "TraceLeftColumnInner") and '
            f'contains(normalize-space(), "{op} — {description}")]'
        )
        self.browser.wait_until(xpath=xpath)
        return self.browser.find_element(by=By.XPATH, value=xpath)

    def expand_trace_rows(self) -> None:
        self.browser.wait_until_clickable(selector=".TraceChildrenCount")
        self.browser.find_element(by=By.CSS_SELECTOR, value=".TraceChildrenCount").click()

    def wait_until_loaded(self) -> None:
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def normalize_span_row_text(self, text: str) -> str:
        # Remove newlines and extra spaces
        return text.replace("\n", " ").replace("—", "-").strip()
