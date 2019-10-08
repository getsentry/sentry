from __future__ import absolute_import

from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase

from tests.acceptance.page_objects.issue_list import IssueListPage


class OrganizationGlobalHeaderTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationGlobalHeaderTest, self).setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.other_project = self.create_project(
            organization=self.org, teams=[self.team], name="Sumatra"
        )
        self.login_as(self.user)
        self.page = IssueListPage(self.browser, self.client)

    def test_global_selection_header_dropdown(self):
        self.project.update(first_event=timezone.now())
        self.page.visit_issue_list(self.org.slug, query="?query=assigned%3Ame")
        self.browser.wait_until_test_id("empty-state")

        self.browser.click('[data-test-id="global-header-project-selector"]')
        self.browser.snapshot("globalSelectionHeader - project selector")

        self.browser.click('[data-test-id="global-header-environment-selector"]')
        self.browser.snapshot("globalSelectionHeader - environment selector")

        self.browser.click('[data-test-id="global-header-timerange-selector"]')
        self.browser.snapshot("globalSelectionHeader - timerange selector")
