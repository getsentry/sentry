from __future__ import absolute_import

import pytz

from datetime import datetime
from django.utils import timezone

from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from tests.acceptance.page_objects.issue_list import IssueListPage

from sentry.utils.compat.mock import patch


event_time = before_now(days=3).replace(tzinfo=pytz.utc)


class OrganizationGroupIndexTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationGroupIndexTest, self).setUp()
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
        self.dismiss_assistant()

    def create_issues(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(event_time),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh snap",
                "timestamp": iso_format(event_time),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

    def test_with_onboarding(self):
        self.project.update(first_event=None)
        self.page.visit_issue_list(self.org.slug)
        self.browser.wait_until_test_id("awaiting-events")
        self.browser.snapshot("organization issues onboarding")

    def test_with_no_results(self):
        self.project.update(first_event=timezone.now())
        self.page.visit_issue_list(self.org.slug, query="?query=assigned%3Ame")
        self.browser.wait_until_test_id("empty-state")
        self.browser.snapshot("organization issues no results")

    @patch("django.utils.timezone.now")
    def test_with_results(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()
        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()
        self.browser.snapshot("organization issues with issues")

        groups = self.browser.elements('[data-test-id="event-issue-header"]')
        assert len(groups) == 2
        assert "oh snap" in groups[0].text
        assert "oh no" in groups[1].text

    @patch("django.utils.timezone.now")
    def test_resolve_issues(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()
        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        self.page.select_issue(1)
        self.page.select_issue(2)
        self.page.resolve_issues()
        self.page.wait_for_resolved_issue()
        resolved_groups = self.page.find_resolved_issues()

        assert len(resolved_groups) == 2

    @patch("django.utils.timezone.now")
    def test_resolve_issues_multi_projects(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()

        with self.feature("organizations:global-views"):
            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.select_issue(2)
            self.page.resolve_issues()
            self.page.wait_for_resolved_issue()
            resolved_groups = self.page.find_resolved_issues()

            assert len(resolved_groups) == 2
