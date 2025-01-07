from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.utils import timezone as django_timezone

from fixtures.page_objects.issue_list import IssueListPage
from sentry.models.assistant import AssistantActivity
from sentry.models.group import GroupStatus
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

event_time = before_now(days=3)


@no_silo_test
class OrganizationGroupIndexTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
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
        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": (event_time - timedelta(hours=1)).isoformat(),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        add_group_to_inbox(self.event_a.group, GroupInboxReason.NEW)
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh snap",
                "timestamp": event_time.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        add_group_to_inbox(self.event_b.group, GroupInboxReason.NEW)

    def test_with_onboarding(self):
        self.project.update(first_event=None)
        self.page.visit_issue_list(self.org.slug)
        self.browser.wait_until_test_id("awaiting-events")

    def test_with_no_results(self):
        self.project.update(first_event=django_timezone.now())
        self.page.visit_issue_list(self.org.slug, query="?query=assigned%3Ame")
        self.browser.wait_until_test_id("empty-state")

    @patch("django.utils.timezone.now")
    def test_with_results(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()
        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        groups = self.browser.elements('[data-test-id="event-issue-header"]')
        assert len(groups) == 2
        assert "oh snap" in groups[0].text
        assert "oh no" in groups[1].text

    @patch("django.utils.timezone.now")
    def test_resolve_issues_removal(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()
        group1 = self.event_a.group

        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        self.page.select_issue(1)
        self.page.resolve_issues()

        group1.update(status=GroupStatus.RESOLVED, substatus=None)

        self.page.wait_for_issue_removal()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')

        assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_resolve_issues_removal_multi_projects(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        with self.feature(["organizations:global-views"]):
            group1 = self.event_a.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.resolve_issues()

            group1.update(status=GroupStatus.RESOLVED, substatus=None)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_archive_issues(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        group1 = self.event_a.group

        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        self.page.select_issue(1)
        self.page.archive_issues()

        group1.update(status=GroupStatus.IGNORED, substatus=None)

        self.page.wait_for_issue_removal()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')

        assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_archive_issues_multi_projects(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        group1 = self.event_a.group

        with self.feature("organizations:global-views"):
            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.archive_issues()

            group1.update(status=GroupStatus.IGNORED, substatus=None)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_delete_issues(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        group1 = self.event_a.group

        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        self.page.select_issue(1)
        self.page.delete_issues()

        group1.update(status=GroupStatus.PENDING_DELETION, substatus=None)

        self.page.wait_for_issue_removal()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')

        assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_delete_issues_multi_projects(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        group1 = self.event_a.group

        with self.feature("organizations:global-views"):
            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.delete_issues()

            group1.update(status=GroupStatus.PENDING_DELETION, substatus=None)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_merge_issues(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()

        group1 = self.event_a.group
        group2 = self.event_b.group

        self.page.visit_issue_list(self.org.slug)
        self.page.wait_for_stream()

        self.page.select_issue(1)
        self.page.select_issue(2)
        self.page.merge_issues()

        group1.update(status=GroupStatus.PENDING_MERGE, substatus=None)
        group2.update(status=GroupStatus.PENDING_MERGE, substatus=None)

        self.page.wait_for_issue_removal()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')

        assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_inbox_results(self, mock_now):
        mock_now.return_value = datetime.now(timezone.utc)
        self.create_issues()
        # Disable for_review_guide
        AssistantActivity.objects.create(
            user=self.user, guide_id=9, viewed_ts=django_timezone.now()
        )

        self.page.visit_issue_list(
            self.org.slug,
            query="?query=is%3Aunresolved+is%3Afor_review+assigned_or_suggested%3A[me, none]",
        )
        self.page.wait_for_stream()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')
        assert len(groups) == 2

        self.page.select_issue(1)
        self.page.mark_reviewed_issues()

        self.page.visit_issue_list(
            self.org.slug,
            query="?query=is%3Aunresolved+is%3Afor_review+assigned_or_suggested%3A[me, none]",
        )
        self.page.wait_for_stream()
        groups = self.browser.elements('[data-test-id="event-issue-header"]')
        assert len(groups) == 1
