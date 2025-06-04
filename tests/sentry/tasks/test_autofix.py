from datetime import datetime, timedelta
from unittest.mock import patch

from django.test import TestCase

from sentry.autofix.utils import AutofixState, AutofixStatus
from sentry.tasks.autofix import check_autofix_status


class TestCheckAutofixStatus(TestCase):
    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_processing_too_long(self, mock_logger, mock_get_autofix_state):
        # Mock the get_autofix_state function to return a state that's been processing for too long
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123)

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
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.now() - timedelta(minutes=3),  # Naive datetime
            status=AutofixStatus.PROCESSING,
        )

        # Call the task
        check_autofix_status(123)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_completed(self, mock_logger, mock_get_autofix_state):
        # Mock the get_autofix_state function to return a completed state
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.now() - timedelta(minutes=10),  # Naive datetime
            status=AutofixStatus.COMPLETED,
        )

        # Call the task
        check_autofix_status(123)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()

    @patch("sentry.tasks.autofix.get_autofix_state")
    @patch("sentry.tasks.autofix.logger.error")
    def test_check_autofix_status_no_state(self, mock_logger, mock_get_autofix_state):
        # Mock the get_autofix_state function to return None (no state found)
        mock_get_autofix_state.return_value = None

        # Call the task
        check_autofix_status(123)

        # Check that the logger.error was not called
        mock_logger.assert_not_called()
