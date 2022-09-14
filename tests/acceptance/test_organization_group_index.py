from datetime import datetime
from unittest.mock import patch

import pytz
from django.utils import timezone

from fixtures.page_objects.issue_list import IssueListPage
from sentry.models import AssistantActivity, GroupInboxReason, GroupStatus
from sentry.models.groupinbox import add_group_to_inbox
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

event_time = before_now(days=3).replace(tzinfo=pytz.utc)


@region_silo_test
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
                "timestamp": iso_format(event_time),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        add_group_to_inbox(self.event_a.group, GroupInboxReason.NEW)
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh snap",
                "timestamp": iso_format(event_time),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        add_group_to_inbox(self.event_b.group, GroupInboxReason.NEW)

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
    def test_resolve_issues_removal(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            group1 = self.event_a.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.resolve_issues_removal()

            group1.update(status=GroupStatus.RESOLVED)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

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

    @patch("django.utils.timezone.now")
    def test_resolve_issues_removal_multi_projects(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()

        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature(
            ["organizations:global-views", "organizations:issue-list-removal-action"]
        ):
            group1 = self.event_a.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.resolve_issues_removal()

            group1.update(status=GroupStatus.RESOLVED)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_ignore_issues(self, mock_now):
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
            self.create_issues()

            group1 = self.event_a.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.ignore_issues()

            group1.update(status=GroupStatus.IGNORED)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_ignore_issues_multi_projects(self, mock_now):
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
            self.create_issues()

            group1 = self.event_a.group

            with self.feature("organizations:global-views"):
                self.page.visit_issue_list(self.org.slug)
                self.page.wait_for_stream()

                self.page.select_issue(1)
                self.page.ignore_issues()

                group1.update(status=GroupStatus.IGNORED)

                self.page.wait_for_issue_removal()
                groups = self.browser.elements('[data-test-id="event-issue-header"]')

                assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_delete_issues(self, mock_now):
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
            self.create_issues()

            group1 = self.event_a.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.delete_issues()

            group1.update(status=GroupStatus.PENDING_DELETION)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_delete_issues_multi_projects(self, mock_now):
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
            self.create_issues()

            group1 = self.event_a.group

            with self.feature("organizations:global-views"):
                self.page.visit_issue_list(self.org.slug)
                self.page.wait_for_stream()

                self.page.select_issue(1)
                self.page.delete_issues()

                group1.update(status=GroupStatus.PENDING_DELETION)

                self.page.wait_for_issue_removal()
                groups = self.browser.elements('[data-test-id="event-issue-header"]')

                assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_merge_issues(self, mock_now):
        # TODO(Kelly): update once issue-list-removal-action feature is stable
        with self.feature("organizations:issue-list-removal-action"):
            mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
            self.create_issues()

            group1 = self.event_a.group
            group2 = self.event_b.group

            self.page.visit_issue_list(self.org.slug)
            self.page.wait_for_stream()

            self.page.select_issue(1)
            self.page.select_issue(2)
            self.page.merge_issues()

            group1.update(status=GroupStatus.PENDING_MERGE)
            group2.update(status=GroupStatus.PENDING_MERGE)

            self.page.wait_for_issue_removal()
            groups = self.browser.elements('[data-test-id="event-issue-header"]')

            assert len(groups) == 1

    @patch("django.utils.timezone.now")
    def test_inbox_results(self, mock_now):
        mock_now.return_value = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.create_issues()
        # Disable for_review_guide
        AssistantActivity.objects.create(user=self.user, guide_id=9, viewed_ts=timezone.now())

        self.page.visit_issue_list(
            self.org.slug,
            query="?query=is%3Aunresolved+is%3Afor_review+assigned_or_suggested%3A[me, none]",
        )
        self.page.wait_for_stream()
        self.browser.snapshot("organization issues inbox results")
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
