from unittest.mock import MagicMock, patch

from urllib3 import BaseHTTPResponse

from sentry.seer.code_review.tasks import PREFIX, process_github_webhook_event
from sentry.testutils.cases import TestCase


class ProcessGitHubWebhookEventTest(TestCase):
    """Unit tests for the process_github_webhook_event task."""

    def _mock_response(self, status: int, data: bytes) -> BaseHTTPResponse:
        """Helper to create mock urllib3 response."""
        mock_response = MagicMock(spec=BaseHTTPResponse)
        mock_response.status = status
        mock_response.data = data
        return mock_response

    def _create_mock_task_self(self, retries: int = 0) -> MagicMock:
        """Helper to create a mock task self object with request context."""
        mock_self = MagicMock()
        mock_self.request.retries = retries
        return mock_self

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_seer_error_response_logged(self, mock_request: MagicMock) -> None:
        """Test that Seer error responses are logged."""
        mock_request.return_value = self._mock_response(
            500, b'{"detail": "Error handling check_run rerun."}'
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self (retry count doesn't matter for this test)
                mock_self = self._create_mock_task_self(retries=0)

                # Call the task directly
                process_github_webhook_event._func(
                    mock_self,
                    organization_id=self.organization.id,
                    original_run_id="4663713",
                )

                # Verify Seer API error was logged
                mock_logger.error.assert_called_once()
                assert mock_logger.error.call_args[0][0] == "%s.error"
                assert mock_logger.error.call_args[0][1] == PREFIX

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_network_error_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that network errors are re-raised to trigger task retry."""
        from urllib3.exceptions import MaxRetryError

        mock_request.side_effect = MaxRetryError(None, "test", reason="Connection failed")  # type: ignore[arg-type]

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise exception to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id="4663713",
                    )
                    assert False, "Expected MaxRetryError to be raised"
                except MaxRetryError:
                    pass

                # Verify exception was logged on last retry
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_timeout_error_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that timeout errors are re-raised to trigger task retry."""
        from urllib3.exceptions import TimeoutError

        mock_request.side_effect = TimeoutError("Request timed out")

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise exception to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id="4663713",
                    )
                    assert False, "Expected TimeoutError to be raised"
                except TimeoutError:
                    pass

                # Verify exception was logged on last retry
                mock_logger.exception.assert_called_once()

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_ssl_error_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that SSL errors are re-raised to trigger task retry."""
        from urllib3.exceptions import SSLError

        mock_request.side_effect = SSLError("Certificate verification failed")

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise exception to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id="4663713",
                    )
                    assert False, "Expected SSLError to be raised"
                except SSLError:
                    pass

                # Verify exception was logged on last retry
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_new_connection_error_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that connection errors are re-raised to trigger task retry."""
        from urllib3.exceptions import NewConnectionError

        mock_request.side_effect = NewConnectionError(None, "Failed to establish connection")  # type: ignore[arg-type]

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise exception to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id="4663713",
                    )
                    assert False, "Expected NewConnectionError to be raised"
                except NewConnectionError:
                    pass

                # Verify exception was logged on last retry
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_network_error_not_logged_on_early_retry(self, mock_request: MagicMock) -> None:
        """Test that network errors are NOT logged on early retry attempts (only on last retry)."""
        from urllib3.exceptions import TimeoutError

        mock_request.side_effect = TimeoutError("Request timed out")

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on first retry (not last)
                mock_self = self._create_mock_task_self(retries=0)

                # Task should raise exception to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id="4663713",
                    )
                    assert False, "Expected TimeoutError to be raised"
                except TimeoutError:
                    pass

                # Verify exception was NOT logged on early retry
                mock_logger.exception.assert_not_called()
