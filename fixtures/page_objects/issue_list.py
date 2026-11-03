from django.test import Client
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.wait import WebDriverWait

from sentry.testutils.pytest.selenium import Browser

from .base import BasePage
from .global_selection import GlobalSelectionPage
from .issue_details import IssueDetailsPage


class IssueListPage(BasePage):
    def __init__(self, browser: Browser, client: Client) -> None:
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_issue_list(self, org: str, query: str = "") -> None:
        self.browser.get(f"/organizations/{org}/issues/{query}")
        self.wait_until_loaded()

    def wait_for_stream(self) -> None:
        self.browser.wait_until('[data-test-id="event-issue-header"]', timeout=20)

    def select_issue(self, position: int) -> None:
        # Must hover over the row to show the checkbox
        self.browser.move_to(f'[data-test-id="group"]:nth-child({position})')
        self.browser.click(f'[data-test-id="group"]:nth-child({position}) input[type="checkbox"]')

    def navigate_to_issue(self, position: int) -> None:
        self.browser.click(f'[data-test-id="group"]:nth-child({position}) a')
        self.browser.wait_until('[data-test-id="group-event-details"]')
        self.issue_details = IssueDetailsPage(self.browser, self.client)

    def resolve_issues(self) -> None:
        self.browser.click('[aria-label="Resolve"]')

    def wait_for_issue_count(self, count: int) -> None:
        WebDriverWait(self.driver, 10).until(
            lambda driver: len(
                driver.find_elements(By.CSS_SELECTOR, '[data-test-id="event-issue-header"]')
            )
            == count,
            message=f"Expected {count} issues in the list",
        )

    def wait_for_issue(self) -> None:
        self.browser.wait_until('[data-test-id="group"]')

    def find_resolved_issues(self) -> list[WebElement]:
        return self.browser.elements('[data-test-id="resolved-issue"]')

    def archive_issues(self) -> None:
        self.browser.click('[aria-label="Archive"]')

    def delete_issues(self) -> None:
        self.browser.click('[aria-label="More issue actions"]')
        self.browser.wait_until('[data-test-id="delete"]')
        self.browser.click('[data-test-id="delete"]')
        self.browser.click('[data-test-id="confirm-button"]')

    def merge_issues(self) -> None:
        # Merge button gets put into an overflow menu for small viewports
        if self.browser.element_exists('[aria-label="Merge"]'):
            self.browser.click('[aria-label="Merge"]')
            self.browser.click('[data-test-id="confirm-button"]')
        else:
            self.browser.click('[aria-label="More issue actions"]')
            self.browser.wait_until('[data-test-id="merge"]')
            self.browser.click('[data-test-id="merge"]')
            self.browser.click('[data-test-id="confirm-button"]')

    def mark_reviewed_issues(self) -> None:
        # Marked reviewed button gets put into an overflow menu for small viewports
        if self.browser.element_exists('[aria-label="Mark Reviewed"]'):
            self.browser.click('[aria-label="Mark Reviewed"]')
        else:
            self.browser.click('[aria-label="More issue actions"]')
            self.browser.wait_until('[data-test-id="mark-reviewed"]')
            self.browser.click('[data-test-id="mark-reviewed"]')
