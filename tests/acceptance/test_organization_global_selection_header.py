from __future__ import absolute_import

import six

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

        self.project_1 = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal"
        )
        self.project_2 = self.create_project(
            organization=self.org, teams=[self.team], name="Sumatra"
        )
        self.project_3 = self.create_project(
            organization=self.org, teams=[self.team], name="Siberian"
        )

        self.create_environment(name="development", project=self.project_1)
        self.create_environment(name="production", project=self.project_1)
        self.create_environment(name="visible", project=self.project_1, is_hidden=False)
        self.create_environment(name="not visible", project=self.project_1, is_hidden=True)

        self.login_as(self.user)
        self.page = IssueListPage(self.browser, self.client)

    def test_global_selection_header_dropdown(self):
        self.project.update(first_event=timezone.now())
        self.page.visit_issue_list(
            self.org.slug, query="?query=assigned%3Ame&project=" + six.text_type(self.project_1.id)
        )
        self.browser.wait_until_test_id("awaiting-events")

        self.browser.click('[data-test-id="global-header-project-selector"]')
        self.browser.snapshot("globalSelectionHeader - project selector")

        self.browser.click('[data-test-id="global-header-environment-selector"]')
        self.browser.snapshot("globalSelectionHeader - environment selector")

        self.browser.click('[data-test-id="global-header-timerange-selector"]')
        self.browser.snapshot("globalSelectionHeader - timerange selector")
