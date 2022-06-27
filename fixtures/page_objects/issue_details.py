from selenium.webdriver.common.by import By

from .base import BasePage
from .global_selection import GlobalSelectionPage


class IssueDetailsPage(BasePage):
    def __init__(self, browser, client):
        super().__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_issue(self, org, groupid):
        self.browser.get(f"/organizations/{org}/issues/{groupid}/")
        self.wait_until_loaded()

    def visit_issue_activity(self, org, groupid):
        self.browser.get(f"/organizations/{org}/issues/{groupid}/activity/")
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def visit_issue_in_environment(self, org, groupid, environment):
        self.browser.get(f"/organizations/{org}/issues/{groupid}/?environment={environment}")
        self.browser.wait_until(".group-detail")

    def visit_tag_values(self, org, groupid, tag):
        self.browser.get(f"/organizations/{org}/issues/{groupid}/tags/{tag}/")
        self.browser.wait_until('[data-test-id="group-tag-value"]')

    def get_environment(self):
        return self.browser.find_element(
            by=By.CSS_SELECTOR, value='[data-test-id="env-label"'
        ).text.lower()

    def go_back_to_issues(self):
        self.global_selection.go_back_to_issues()

    def api_issue_get(self, groupid):
        return self.client.get(f"/api/0/issues/{groupid}/")

    def go_to_subtab(self, name):
        tabs = self.browser.find_element(by=By.CSS_SELECTOR, value=".group-detail .nav-tabs")
        tabs.find_element(by=By.PARTIAL_LINK_TEXT, value=name).click()
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def open_issue_errors(self):
        self.browser.click(".errors-toggle")
        self.browser.wait_until(".entries > .errors ul")

    def open_curl(self):
        self.browser.find_element(by=By.XPATH, value="//a//code[contains(text(), 'curl')]").click()

    def resolve_issue(self):
        self.browser.click('[aria-label="Resolve"]')
        # Resolve should become unresolve
        self.browser.wait_until('[aria-label="Unresolve"]')

    def ignore_issue(self):
        self.browser.click('[aria-label="Ignore"]')
        # Ignore should become unresolve
        self.browser.wait_until('[aria-label="Unignore"]')

    def bookmark_issue(self):
        self.browser.click('button[aria-label="More Actions"]')
        self.browser.wait_until('[data-test-id="bookmark"]')
        button = self.browser.element('[data-test-id="bookmark"]')
        button.click()
        self.browser.click('button[aria-label="More Actions"]')
        self.browser.wait_until('[data-test-id="unbookmark"]')

    def assign_to(self, user):
        assignee = self.browser.find_element(by=By.CSS_SELECTOR, value=".assigned-to")

        # Open the assignee picker
        assignee.find_element(by=By.CSS_SELECTOR, value='[role="button"]').click()
        assignee.find_element(by=By.TAG_NAME, value="input").send_keys(user)

        # Click the member/team
        options = assignee.find_elements(
            by=By.CSS_SELECTOR, value='[data-test-id="assignee-option"]'
        )
        assert len(options) > 0, "No assignees could be found."
        options[0].click()

        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def find_comment_form(self):
        return self.browser.find_element(
            by=By.CSS_SELECTOR, value='[data-test-id="note-input-form"]'
        )

    def has_comment(self, text):
        element = self.browser.element('[data-test-id="activity-note-body"]')
        return text in element.text

    def wait_until_loaded(self):
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_test_id("event-entries-loading-false")
        self.browser.wait_until_test_id("linked-issues")
        self.browser.wait_until_test_id("loaded-device-name")
        if self.browser.element_exists("#grouping-info"):
            self.browser.wait_until_test_id("loaded-grouping-info")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def mark_reviewed(self):
        self.browser.click('[aria-label="Mark Reviewed"]')
        self.browser.wait_until('.disabled[aria-label="Mark Reviewed"]')
