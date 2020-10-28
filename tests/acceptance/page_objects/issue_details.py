from __future__ import absolute_import

from .base import BasePage
from .global_selection import GlobalSelectionPage


class IssueDetailsPage(BasePage):
    def __init__(self, browser, client):
        super(IssueDetailsPage, self).__init__(browser)
        self.client = client
        self.global_selection = GlobalSelectionPage(browser)

    def visit_issue(self, org, groupid):
        self.browser.get(u"/organizations/{}/issues/{}/".format(org, groupid))
        self.wait_until_loaded()

    def visit_issue_in_environment(self, org, groupid, environment):
        self.browser.get(
            u"/organizations/{}/issues/{}/?environment={}".format(org, groupid, environment)
        )
        self.browser.wait_until(".group-detail")

    def visit_tag_values(self, org, groupid, tag):
        self.browser.get(u"/organizations/{}/issues/{}/tags/{}".format(org, groupid, tag))
        self.browser.wait_until_not(".loading-indicator")

    def get_environment(self):
        return self.browser.find_element_by_css_selector('[data-test-id="env-label"').text.lower()

    def go_back_to_issues(self):
        self.global_selection.go_back_to_issues()

    def api_issue_get(self, groupid):
        return self.client.get(u"/api/0/issues/{}/".format(groupid))

    def go_to_subtab(self, name):
        tabs = self.browser.find_element_by_css_selector(".group-detail .nav-tabs")
        tabs.find_element_by_partial_link_text(name).click()
        self.browser.wait_until_not(".loading-indicator")

    def open_issue_errors(self):
        self.browser.click(".errors-toggle")
        self.browser.wait_until(".entries > .errors ul")

    def open_curl(self):
        self.browser.find_element_by_xpath("//a//code[contains(text(), 'curl')]").click()

    def resolve_issue(self):
        self.browser.click('[data-test-id="action-link-resolve"]')
        # Resolve should become unresolve
        self.browser.wait_until('[data-test-id="button-unresolve"]')

    def ignore_issue(self):
        self.browser.click('[data-test-id="action-link-ignore"]')
        # Ignore should become unresolve
        self.browser.wait_until('[data-test-id="button-unresolve"]')

    def bookmark_issue(self):
        self.browser.click(".group-bookmark")
        self.browser.wait_until(".group-bookmark.active")

    def assign_to(self, user):
        assignee = self.browser.find_element_by_css_selector(".assigned-to")

        # Open the assignee picker
        assignee.find_element_by_css_selector('[role="button"]').click()
        assignee.find_element_by_tag_name("input").send_keys(user)

        # Click the member/team
        options = assignee.find_elements_by_css_selector('[data-test-id="assignee-option"]')
        assert len(options) > 0, "No assignees could be found."
        options[0].click()

        self.browser.wait_until_not(".loading-indicator")

    def find_comment_form(self):
        return self.browser.find_element_by_css_selector('[data-test-id="note-input-form"]')

    def has_comment(self, text):
        element = self.browser.element('[data-test-id="activity-note-body"]')
        return text in element.text

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_test_id("event-entries")
        self.browser.wait_until_test_id("linked-issues")
        self.browser.wait_until_test_id("loaded-device-name")
        if self.browser.element_exists("#grouping-info"):
            self.browser.wait_until_test_id("loaded-grouping-info")
