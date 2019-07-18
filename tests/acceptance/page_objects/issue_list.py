from __future__ import absolute_import

from .base import BasePage


class IssueListPage(BasePage):
    def __init__(self, browser, client):
        super(IssueListPage, self).__init__(browser)
        self.client = client

    def visit_issue_list(self, org):
        self.browser.get(u'/organizations/{}/issues/'.format(org))
        self.wait_until_loaded()

    def wait_for_stream(self):
        self.browser.wait_until('.event-issue-header', timeout=20)

    def select_issue(self, position):
        self.browser.click(u'[data-test-id="group"]:nth-child({})'.format(position))

    def resolve_issues(self):
        self.browser.click('[aria-label="Resolve"]')
        self.browser.click('[data-test-id="confirm-modal"]')

    def wait_until_loaded(self):
        self.browser.wait_until_not('.loading-indicator')
