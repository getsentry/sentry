from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase

from sentry.seer.autofix.constants import AutofixStatus, SeerAutomationSource
from sentry.seer.autofix.utils import AutofixState
from sentry.seer.models import SummarizeIssueResponse, SummarizeIssueScores
from sentry.tasks.autofix import check_autofix_status, generate_issue_summary_only
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
