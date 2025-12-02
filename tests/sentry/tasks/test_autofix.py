from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase

from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import AutofixState
from sentry.seer.models import SummarizeIssueResponse, SummarizeIssueScores
from sentry.tasks.autofix import (
    check_autofix_status,
    configure_seer_for_existing_org,
    generate_issue_summary_only,
)
from sentry.testutils.cases import TestCase as SentryTestCase


class TestCheckAutofixStatus(TestCase):
    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_processing_too_long(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return a state that's been processing for too long
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was called
        mock_logger.assert_called_once_with(
            "Autofix run has been processing for more than 5 minutes", extra={"run_id": 123}
        )

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_processing_within_time_limit(
        self, mock_logger, mock_get_autofix_state
    ):
        # Mock the get_autofix_state function to return a state that's still within the time limit
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=3),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_completed(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return a completed state
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": 789,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.COMPLETED,
        )

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_no_state(
        self, mock_logger: MagicMock, mock_get_autofix_state: MagicMock
    ) -> None:
        # Mock the get_autofix_state function to return None (no state found)
        mock_get_autofix_state.return_value = None

        # Call the task
        check_autofix_status(123, 789)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()


class TestGenerateIssueSummaryOnly(SentryTestCase):
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    @patch("sentry.seer.autofix.issue_summary.get_issue_summary")
    def test_generates_fixability_score(
        self, mock_get_issue_summary: MagicMock, mock_generate_fixability: MagicMock
    ) -> None:
        """Test that fixability score is generated and saved to the group."""
        group = self.create_group(project=self.project)

        mock_generate_fixability.return_value = SummarizeIssueResponse(
            group_id=str(group.id),
            headline="Test",
            whats_wrong="Test",
            trace="Test",
            possible_cause="Test",
            scores=SummarizeIssueScores(fixability_score=0.75, actionability_score=0.85),
        )

        generate_issue_summary_only(group.id)

        mock_get_issue_summary.assert_called_once_with(
            group=group, source=SeerAutomationSource.POST_PROCESS, should_run_automation=False
        )
        mock_generate_fixability.assert_called_once_with(group)

        group.refresh_from_db()
        assert group.seer_fixability_score == 0.75


class TestConfigureSeerForExistingOrg(SentryTestCase):
    @patch("sentry.tasks.autofix.requests.post")
    def test_configures_org_and_project_settings(self, mock_post: MagicMock) -> None:
        """Test that org and project settings are configured correctly."""
        # Mock GET returns no preferences, SET succeeds
        mock_get_response = MagicMock()
        mock_get_response.json.return_value = {"preference": None}
        mock_set_response = MagicMock()
        mock_post.side_effect = [
            mock_get_response,
            mock_set_response,
            mock_get_response,
            mock_set_response,
        ]

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        configure_seer_for_existing_org(
            organization_id=self.organization.id,
            project_ids=[project1.id, project2.id],
        )

        # Check org-level option
        assert self.organization.get_option("sentry:enable_seer_coding") is True

        # Check project-level options
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project1.get_option("sentry:autofix_automation_tuning") == "medium"
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:autofix_automation_tuning") == "medium"

        # 2 projects x 2 calls each (GET + SET)
        assert mock_post.call_count == 4

    @patch("sentry.tasks.autofix.requests.post")
    def test_skips_projects_with_existing_stopping_point(self, mock_post: MagicMock) -> None:
        """Test that projects with open_pr or code_changes stopping point are skipped."""
        mock_get_open_pr = MagicMock()
        mock_get_open_pr.json.return_value = {
            "preference": {"automated_run_stopping_point": "open_pr"}
        }
        mock_get_code_changes = MagicMock()
        mock_get_code_changes.json.return_value = {
            "preference": {"automated_run_stopping_point": "code_changes"}
        }
        mock_post.side_effect = [mock_get_open_pr, mock_get_code_changes]

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        configure_seer_for_existing_org(
            organization_id=self.organization.id,
            project_ids=[project1.id, project2.id],
        )

        # Only GET calls, no SET calls (both skipped)
        assert mock_post.call_count == 2

    @patch("sentry.tasks.autofix.requests.post")
    def test_continues_on_api_failure(self, mock_post: MagicMock) -> None:
        """Test that task continues processing other projects if one API call fails."""
        import requests

        # First project: GET fails. Second project: GET + SET succeed
        mock_get_response = MagicMock()
        mock_get_response.json.return_value = {"preference": None}
        mock_set_response = MagicMock()
        mock_post.side_effect = [
            requests.RequestException("API error"),
            mock_get_response,
            mock_set_response,
        ]

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        configure_seer_for_existing_org(
            organization_id=self.organization.id,
            project_ids=[project1.id, project2.id],
        )

        # Both projects should still have their Sentry DB options set
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True

        # 1 failed GET + 1 GET + 1 SET = 3 calls
        assert mock_post.call_count == 3

    @patch("sentry.tasks.autofix.requests.post")
    def test_ignores_projects_from_other_orgs(self, mock_post: MagicMock) -> None:
        """Test that projects from other orgs are filtered out."""
        mock_get_response = MagicMock()
        mock_get_response.json.return_value = {"preference": None}
        mock_set_response = MagicMock()
        mock_post.side_effect = [mock_get_response, mock_set_response]

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        my_project = self.create_project(organization=self.organization)

        configure_seer_for_existing_org(
            organization_id=self.organization.id,
            project_ids=[my_project.id, other_project.id],
        )

        # Only 2 API calls for my_project (GET + SET)
        assert mock_post.call_count == 2
