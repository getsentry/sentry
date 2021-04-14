from .base import BasePage
from .global_selection import GlobalSelectionPage
from .issue_details import IssueDetailsPage


class IssueListPage(BasePage):
    def __init__(self, browser, client):
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_issue_list(self, org, query=""):
        self.browser.get(f"/organizations/{org}/issues/{query}")
        self.wait_until_loaded()

    def wait_for_stream(self):
        self.browser.wait_until('[data-test-id="event-issue-header"]', timeout=20)

    def select_issue(self, position):
        self.browser.click(f'[data-test-id="group"]:nth-child({position})')

    def navigate_to_issue(self, position):
        self.browser.click(f'[data-test-id="group"]:nth-child({position}) a')
        self.browser.wait_until(".group-detail")
        self.issue_details = IssueDetailsPage(self.browser, self.client)

    def resolve_issues(self):
        self.browser.click('[aria-label="Resolve"]')
        self.browser.click('[data-test-id="confirm-button"]')

    def wait_for_resolved_issue(self):
        self.browser.wait_until('[data-test-id="resolved-issue"]')

    def wait_for_issue(self):
        self.browser.wait_until('[data-test-id="group"]')

    def find_resolved_issues(self):
        return self.browser.elements('[data-test-id="resolved-issue"]')

    def mark_reviewed_issues(self):
        self.browser.click('[aria-label="Mark Reviewed"]')
