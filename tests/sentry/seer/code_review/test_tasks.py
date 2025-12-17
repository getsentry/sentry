from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from sentry_protos.taskbroker.v1.taskbroker_pb2 import RetryState
from urllib3 import BaseHTTPResponse
from urllib3.exceptions import HTTPError

from sentry.seer.code_review.tasks import (
    DELAY_BETWEEN_RETRIES,
    MAX_RETRIES,
    PREFIX,
    process_github_webhook_event,
)
from sentry.testutils.cases import TestCase


class ProcessGitHubWebhookEventTest(TestCase):
    """Unit tests for the process_github_webhook_event task."""

    def setUp(self) -> None:
        super().setUp()
        self.enqueued_at_str = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()
        self.original_run_id = "4663713"

    def test_retry_configuration_includes_http_error(self) -> None:
        """Test that the task is configured to retry on HTTPError exceptions.

        This is a critical test that verifies the retry configuration itself.
        Without on=(HTTPError,), the task would NOT retry despite times=3.
        """
        task = process_github_webhook_event

        # Verify retry configuration exists
        assert task.retry is not None, "Task should have retry configuration"

        # Verify HTTPError is in the allowed exception types
        # This is what allows the taskworker to actually retry on HTTPError
        assert HTTPError in task.retry._allowed_exception_types, (
            "HTTPError must be in retry allowlist for retries to work. "
            "Without this, the task will fail immediately despite times=3."
        )

        # Verify retry count and delay
        assert task.retry._times == 3, "Task should retry 3 times"
        assert task.retry._delay == 60, "Task should delay 60 seconds between retries"

        # Verify should_retry returns True for HTTPError
        from urllib3.exceptions import MaxRetryError

        retry_state = RetryState(attempts=0, max_attempts=3)
        http_error = MaxRetryError(None, "test")  # type: ignore[arg-type]
        assert task.retry.should_retry(
            retry_state, http_error
        ), "Task should retry on HTTPError exceptions"

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
    def test_server_error_response_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that Seer 5xx responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(
            500, b'{"detail": "Error handling check_run rerun."}'
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise HTTPError to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
                    )
                    assert False, "Expected HTTPError to be raised for 500 status"
                except HTTPError:
                    pass

                # Verify retryable status error was logged
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"
                assert mock_logger.exception.call_args[0][1] == PREFIX

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_service_unavailable_response_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that Seer 503 (service unavailable) responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(503, b'{"detail": "Service unavailable"}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise HTTPError to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
                    )
                    assert False, "Expected HTTPError to be raised for 503 status"
                except HTTPError:
                    pass

                # Verify retryable status error was logged
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    def test_rate_limit_response_raises_for_retry(self, mock_request: MagicMock) -> None:
        """Test that Seer 429 (rate limit) responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(429, b'{"detail": "Rate limit exceeded"}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.tasks.logger") as mock_logger:
                # Create mock task self on last retry
                mock_self = self._create_mock_task_self(retries=2)

                # Task should raise HTTPError to trigger retry
                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
                    )
                    assert False, "Expected HTTPError to be raised for 429 status"
                except HTTPError:
                    pass

                # Verify retryable status error was logged
                mock_logger.exception.assert_called_once()
                assert mock_logger.exception.call_args[0][0] == "%s.error"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.tasks.metrics")
    def test_client_error_response_not_retried(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that Seer 4xx client errors (except 429) do NOT trigger retry."""
        mock_request.return_value = self._mock_response(400, b'{"detail": "Bad request"}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            # Create mock task self
            mock_self = self._create_mock_task_self(retries=0)

            # Task should NOT raise exception (client errors are permanent)
            process_github_webhook_event._func(
                mock_self,
                organization_id=self.organization.id,
                original_run_id=self.original_run_id,
                enqueued_at=self.enqueued_at_str,
            )

            # Verify client error was tracked in metrics (not retried)
            mock_metrics.incr.assert_called()
            # Check that status includes client_error
            incr_calls = [call for call in mock_metrics.incr.call_args_list]
            outcome_calls = [call for call in incr_calls if "outcome" in str(call)]
            assert len(outcome_calls) > 0
            # Verify the status tag indicates client error
            outcome_call = outcome_calls[0]
            assert "client_error" in str(outcome_call)

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
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
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
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
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
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
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
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
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
                        original_run_id=self.original_run_id,
                        enqueued_at=self.enqueued_at_str,
                    )
                    assert False, "Expected TimeoutError to be raised"
                except TimeoutError:
                    pass

                # Verify exception was NOT logged on early retry
                mock_logger.exception.assert_not_called()

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.tasks.metrics")
    def test_latency_tracking_on_first_attempt(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that latency is tracked correctly on the first attempt (base case)."""
        mock_request.return_value = self._mock_response(200, b"{}")

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            # Create mock task self for first attempt
            mock_self = self._create_mock_task_self(retries=0)

            # Execute task with enqueued_at timestamp
            process_github_webhook_event._func(
                mock_self,
                organization_id=self.organization.id,
                original_run_id=self.original_run_id,
                enqueued_at=self.enqueued_at_str,
            )

            # Verify latency metric was recorded
            mock_metrics.timing.assert_called_once()
            call_args = mock_metrics.timing.call_args[0]
            assert call_args[0] == f"{PREFIX}.e2e_latency"
            # Latency should be >= 2000ms (2 seconds base + test overhead)
            # Allow wide tolerance for test execution time (1-5 seconds total)
            assert (
                1000 <= call_args[1] <= 5000
            ), f"Expected latency between 1-5s, got {call_args[1]}ms"

    @patch("sentry.seer.code_review.tasks.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.tasks.metrics")
    def test_latency_tracking_on_max_retries_with_failures(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that latency is tracked once on final attempt after max retries with failures."""
        from urllib3.exceptions import MaxRetryError

        # Make the Seer API call fail 3 times with HTTPError
        mock_request.side_effect = MaxRetryError(None, "test", reason="Connection failed")  # type: ignore[arg-type]

        # Create an enqueued_at timestamp in the past to simulate retry delays
        # With MAX_RETRIES=3, there are 2 delays between 3 attempts: (3-1) * 60s = 120s
        enqueued_at_str = (
            datetime.now(timezone.utc)
            - timedelta(seconds=DELAY_BETWEEN_RETRIES * (MAX_RETRIES - 1))
        ).isoformat()

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            # Simulate 3 attempts (initial + 2 retries)
            for retry_count in range(MAX_RETRIES):
                mock_self = self._create_mock_task_self(retries=retry_count)

                try:
                    process_github_webhook_event._func(
                        mock_self,
                        organization_id=self.organization.id,
                        original_run_id=self.original_run_id,
                        enqueued_at=enqueued_at_str,
                    )
                    # Should not reach here - exception should be raised
                    assert False, "Expected MaxRetryError to be raised"
                except MaxRetryError:
                    pass  # Expected

            # Verify timing was called exactly once (on the last attempt only)
            mock_metrics.timing.assert_called_once()
            call_args = mock_metrics.timing.call_args[0]
            assert call_args[0] == f"{PREFIX}.e2e_latency"

            # Verify timing has status tag
            call_kwargs = mock_metrics.timing.call_args[1]
            assert "tags" in call_kwargs
            assert "status" in call_kwargs["tags"]

            # Latency should be approximately 2 minutes (120,000ms)
            # With MAX_RETRIES=3, there are 2 delays: (3-1) * 60s = 120s
            # Allow tolerance for test execution time (3 attempts add overhead)
            expected_latency_ms = (MAX_RETRIES - 1) * DELAY_BETWEEN_RETRIES * 1000  # 120,000ms
            assert (
                expected_latency_ms - 1000 <= call_args[1] <= expected_latency_ms + 5000
            ), f"Expected latency ~{expected_latency_ms}ms, got {call_args[1]}ms"
