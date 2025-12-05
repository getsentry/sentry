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
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        # Set to non-off value so we can verify it gets changed to medium
        project1.update_option("sentry:autofix_automation_tuning", "low")
        project2.update_option("sentry:autofix_automation_tuning", "high")

        # Mock bulk GET returns no preferences for any project
        mock_bulk_get_response = MagicMock()
        mock_bulk_get_response.json.return_value = {
            "preferences": {
                str(project1.id): None,
                str(project2.id): None,
            }
        }
        # Mock bulk SET succeeds
        mock_bulk_set_response = MagicMock()
        mock_post.side_effect = [mock_bulk_get_response, mock_bulk_set_response]

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Check org-level option
        assert self.organization.get_option("sentry:enable_seer_coding") is True

        # Check project-level options
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project1.get_option("sentry:autofix_automation_tuning") == "medium"
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:autofix_automation_tuning") == "medium"

        # 1 bulk GET + 1 bulk SET
        assert mock_post.call_count == 2

    @patch("sentry.tasks.autofix.requests.post")
    def test_keeps_autofix_off_if_explicitly_disabled(self, mock_post: MagicMock) -> None:
        """Test that projects with autofix explicitly set to off keep it off."""
        project = self.create_project(organization=self.organization)
        project.update_option("sentry:autofix_automation_tuning", "off")

        # Mock bulk GET returns no preference
        mock_bulk_get_response = MagicMock()
        mock_bulk_get_response.json.return_value = {"preferences": {str(project.id): None}}
        mock_bulk_set_response = MagicMock()
        mock_post.side_effect = [mock_bulk_get_response, mock_bulk_set_response]

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # autofix_automation_tuning should stay off
        assert project.get_option("sentry:autofix_automation_tuning") == "off"
        # But scanner should still be enabled
        assert project.get_option("sentry:seer_scanner_automation") is True

    @patch("sentry.tasks.autofix.requests.post")
    def test_skips_projects_with_existing_stopping_point(self, mock_post: MagicMock) -> None:
        """Test that projects with open_pr or code_changes stopping point are skipped."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        # Mock bulk GET returns preferences with stopping points already set
        mock_bulk_get_response = MagicMock()
        mock_bulk_get_response.json.return_value = {
            "preferences": {
                str(project1.id): {"automated_run_stopping_point": "open_pr"},
                str(project2.id): {"automated_run_stopping_point": "code_changes"},
            }
        }
        mock_post.side_effect = [mock_bulk_get_response]

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Only bulk GET call, no bulk SET call (both projects skipped)
        assert mock_post.call_count == 1

    @patch("sentry.tasks.autofix.requests.post")
    def test_raises_on_bulk_get_api_failure(self, mock_post: MagicMock) -> None:
        """Test that task raises on bulk GET API failure to trigger retry."""
        import pytest
        import requests

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_post.side_effect = [requests.RequestException("API error")]

        with pytest.raises(requests.RequestException):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        # Sentry DB options should still be set before the API call
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert mock_post.call_count == 1

    @patch("sentry.tasks.autofix.requests.post")
    def test_raises_on_bulk_set_api_failure(self, mock_post: MagicMock) -> None:
        """Test that task raises on bulk SET API failure to trigger retry."""
        import pytest
        import requests

        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        mock_bulk_get_response = MagicMock()
        mock_bulk_get_response.json.return_value = {
            "preferences": {str(project1.id): None, str(project2.id): None}
        }
        mock_post.side_effect = [mock_bulk_get_response, requests.RequestException("API error")]

        with pytest.raises(requests.RequestException):
            configure_seer_for_existing_org(organization_id=self.organization.id)

        # Sentry DB options should still be set before the API call
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True
        assert mock_post.call_count == 2

    @patch("sentry.tasks.autofix.requests.post")
    def test_handles_malformed_preferences_in_bulk_response(self, mock_post: MagicMock) -> None:
        """Test that task handles malformed preferences in bulk response."""
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)

        # Bulk GET returns malformed preference for project1 (string instead of dict)
        mock_bulk_get_response = MagicMock()
        mock_bulk_get_response.json.return_value = {
            "preferences": {
                str(project1.id): "not_a_dict",
                str(project2.id): None,
            }
        }
        mock_bulk_set_response = MagicMock()
        mock_post.side_effect = [mock_bulk_get_response, mock_bulk_set_response]

        configure_seer_for_existing_org(organization_id=self.organization.id)

        # Both projects should still have their Sentry DB options set
        assert project1.get_option("sentry:seer_scanner_automation") is True
        assert project2.get_option("sentry:seer_scanner_automation") is True

        # 1 bulk GET + 1 bulk SET
        assert mock_post.call_count == 2
