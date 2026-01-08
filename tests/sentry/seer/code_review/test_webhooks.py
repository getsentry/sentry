from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sentry_protos.taskbroker.v1.taskbroker_pb2 import RetryState
from urllib3 import BaseHTTPResponse
from urllib3.exceptions import HTTPError

from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.utils import ClientError
from sentry.seer.code_review.webhooks.issue_comment import (
    _add_eyes_reaction_to_comment,
    is_pr_review_command,
)
from sentry.seer.code_review.webhooks.task import (
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

        assert task.retry is not None, "Task should have retry configuration"

        # This is what allows the taskworker to actually retry on HTTPError
        assert HTTPError in task.retry._allowed_exception_types, (
            "HTTPError must be in retry allowlist for retries to work. "
            "Without this, the task will fail immediately despite times=3."
        )

        assert task.retry._times == 3, "Task should retry 3 times"
        assert task.retry._delay == 60, "Task should delay 60 seconds between retries"

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

    def _create_mock_task_state(self, retries_remaining: bool = True) -> MagicMock:
        """Helper to create a mock CurrentTaskState object."""
        mock_state = MagicMock()
        mock_state.retries_remaining = retries_remaining
        return mock_state

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_server_error_response_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that Seer 5xx responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(
            500, b'{"detail": "Error handling check_run rerun."}'
        )
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(HTTPError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "HTTPError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_service_unavailable_response_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that Seer 503 (service unavailable) responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(503, b'{"detail": "Service unavailable"}')
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(HTTPError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "HTTPError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_rate_limit_response_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that Seer 429 (rate limit) responses are raised to trigger task retry."""
        mock_request.return_value = self._mock_response(429, b'{"detail": "Rate limit exceeded"}')
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(HTTPError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "HTTPError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_client_error_response_not_retried(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that Seer 4xx client errors (except 429) do NOT trigger retry."""
        mock_request.return_value = self._mock_response(400, b'{"detail": "Bad request"}')

        with pytest.raises(ClientError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Client error tracked in metrics with appropriate status label, not retried
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        outcome_call = outcome_calls[0]
        assert "seer.code_review.task.error" in str(outcome_call)

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_network_error_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that network errors are re-raised to trigger task retry."""
        from urllib3.exceptions import MaxRetryError

        mock_request.side_effect = MaxRetryError(None, "test", reason="Connection failed")  # type: ignore[arg-type]
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(MaxRetryError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "MaxRetryError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_timeout_error_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that timeout errors are re-raised to trigger task retry."""
        from urllib3.exceptions import TimeoutError

        mock_request.side_effect = TimeoutError("Request timed out")
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(TimeoutError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "TimeoutError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_ssl_error_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that SSL errors are re-raised to trigger task retry."""
        from urllib3.exceptions import SSLError

        mock_request.side_effect = SSLError("Certificate verification failed")
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(SSLError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "SSLError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_new_connection_error_raises_for_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that connection errors are re-raised to trigger task retry."""
        from urllib3.exceptions import NewConnectionError

        mock_request.side_effect = NewConnectionError(None, "Failed to establish connection")  # type: ignore[arg-type]
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=False)

        with pytest.raises(NewConnectionError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "NewConnectionError" in str(outcome_calls[0])

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_network_error_not_logged_on_early_retry(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that network errors are raised on early retry attempts to trigger retry."""
        from urllib3.exceptions import TimeoutError

        mock_request.side_effect = TimeoutError("Request timed out")
        mock_current_task.return_value = self._create_mock_task_state(retries_remaining=True)

        with pytest.raises(TimeoutError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        # Verify metric is incremented exactly once (not double-counted)
        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        assert "TimeoutError" in str(outcome_calls[0])

        # Verify latency is NOT recorded on early retries (retries remaining)
        mock_metrics.timing.assert_not_called()

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_unexpected_error_logged_and_tracked(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that unexpected errors (non-HTTPError) are tracked in metrics and raised."""
        # e.g., JSON parsing error
        mock_request.side_effect = ValueError("Invalid JSON format")

        # Unexpected exceptions are not retried
        with pytest.raises(ValueError, match="Invalid JSON format"):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.CHECK_RUN,
                event_payload={"original_run_id": self.original_run_id},
                enqueued_at_str=self.enqueued_at_str,
            )

        mock_metrics.incr.assert_called()
        incr_calls = [call for call in mock_metrics.incr.call_args_list]
        outcome_calls = [call for call in incr_calls if "error" in str(call)]
        assert (
            len(outcome_calls) == 1
        ), f"Expected exactly 1 outcome metric, got {len(outcome_calls)}"
        outcome_call = outcome_calls[0]
        assert "ValueError" in str(outcome_call)

        mock_metrics.timing.assert_called_once()

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_latency_tracking_on_first_attempt(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that latency is tracked correctly on the first attempt (base case)."""
        mock_request.return_value = self._mock_response(200, b"{}")

        process_github_webhook_event._func(
            github_event=GithubWebhookType.CHECK_RUN,
            event_payload={"original_run_id": self.original_run_id},
            enqueued_at_str=self.enqueued_at_str,
        )

        mock_metrics.timing.assert_called_once()
        call_args = mock_metrics.timing.call_args[0]
        assert call_args[0] == f"{PREFIX}.e2e_latency"
        # 2 seconds base + test overhead, allow wide tolerance (1-5 seconds total)
        assert 1000 <= call_args[1] <= 5000, f"Expected latency between 1-5s, got {call_args[1]}ms"

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_latency_tracking_on_max_retries_with_failures(
        self, mock_metrics: MagicMock, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        """Test that latency is tracked once on final attempt after max retries with failures."""
        from urllib3.exceptions import MaxRetryError

        mock_request.side_effect = MaxRetryError(None, "test", reason="Connection failed")  # type: ignore[arg-type]

        # With MAX_RETRIES=3, there are 2 delays between 3 attempts: (3-1) * 60s = 120s
        enqueued_at_str = (
            datetime.now(timezone.utc)
            - timedelta(seconds=DELAY_BETWEEN_RETRIES * (MAX_RETRIES - 1))
        ).isoformat()

        for retry_count in range(MAX_RETRIES):
            # On the last retry, retries_remaining is False
            retries_remaining = retry_count < MAX_RETRIES - 1
            mock_current_task.return_value = self._create_mock_task_state(
                retries_remaining=retries_remaining
            )

            try:
                process_github_webhook_event._func(
                    github_event=GithubWebhookType.CHECK_RUN,
                    event_payload={"original_run_id": self.original_run_id},
                    enqueued_at_str=enqueued_at_str,
                )
                assert False, "Expected MaxRetryError to be raised"
            except MaxRetryError:
                pass  # Expected

        # Timing called exactly once on the last attempt only
        mock_metrics.timing.assert_called_once()
        call_args = mock_metrics.timing.call_args[0]
        assert call_args[0] == f"{PREFIX}.e2e_latency"

        call_kwargs = mock_metrics.timing.call_args[1]
        assert "tags" in call_kwargs
        assert "status" in call_kwargs["tags"]

        # With MAX_RETRIES=3, there are 2 delays: (3-1) * 60s = 120s
        # Allow tolerance for test execution time (3 attempts add overhead)
        expected_latency_ms = (MAX_RETRIES - 1) * DELAY_BETWEEN_RETRIES * 1000  # 120,000ms
        assert (
            expected_latency_ms - 1000 <= call_args[1] <= expected_latency_ms + 5000
        ), f"Expected latency ~{expected_latency_ms}ms, got {call_args[1]}ms"

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    @patch("sentry.seer.code_review.webhooks.task.metrics")
    def test_check_run_and_pr_events_processed_separately(
        self, mock_metrics: MagicMock, mock_request: MagicMock
    ) -> None:
        """Test that CHECK_RUN events use rerun endpoint while PR events use overwatch-request."""
        mock_request.return_value = self._mock_response(200, b"{}")

        process_github_webhook_event._func(
            github_event=GithubWebhookType.CHECK_RUN,
            event_payload={"original_run_id": self.original_run_id},
            enqueued_at_str=self.enqueued_at_str,
        )

        assert mock_request.call_count == 1
        check_run_call = mock_request.call_args
        assert check_run_call[1]["path"] == "/v1/automation/codegen/pr-review/rerun"

        mock_request.reset_mock()

        event_payload = {
            "request_type": "pr-review",
            "external_owner_id": "456",
            "data": {
                "repo": {},
                "pr_id": 123,
                "bug_prediction_specific_information": {
                    "organization_id": 789,
                },
                "config": {
                    "features": {
                        "bug_prediction": True,
                    },
                    "trigger": "on_new_commit",
                    "trigger_comment_id": None,
                    "trigger_comment_type": None,
                    "trigger_user": None,
                },
            },
        }

        process_github_webhook_event._func(
            github_event=GithubWebhookType.PULL_REQUEST,
            event_payload=event_payload,
            enqueued_at_str=self.enqueued_at_str,
        )

        assert not mock_request.called


class TestIsPrReviewCommand:
    def test_true_cases(self) -> None:
        assert is_pr_review_command("@sentry review")
        assert is_pr_review_command("Please @sentry review this PR")
        assert is_pr_review_command("@Sentry Review")
        assert is_pr_review_command("@SENTRY REVIEW")

    def test_false_cases(self) -> None:
        assert not is_pr_review_command("This is a regular comment")
        assert not is_pr_review_command("@sentry")
        assert not is_pr_review_command("review")
        assert not is_pr_review_command(None)
        assert not is_pr_review_command("")


class AddEyesReactionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="12345",
            name="owner/repo",
        )

    @patch("sentry.seer.code_review.webhooks.issue_comment.logger")
    def test_logs_warning_when_integration_is_none(self, mock_logger: MagicMock) -> None:
        _add_eyes_reaction_to_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            github_event_action="created",
            integration=None,
            organization=self.organization,
            repo=self.repo,
            comment_id="123",
        )

        mock_logger.warning.assert_called_once()
        assert "missing-integration" in mock_logger.warning.call_args[0][0]

    def test_calls_github_api_with_eyes_reaction(self) -> None:
        mock_client = MagicMock()
        mock_installation = MagicMock()
        mock_installation.get_client.return_value = mock_client
        mock_integration = MagicMock()
        mock_integration.get_installation.return_value = mock_installation

        _add_eyes_reaction_to_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            github_event_action="created",
            integration=mock_integration,
            organization=self.organization,
            repo=self.repo,
            comment_id="123456",
        )

        mock_client.create_comment_reaction.assert_called_once_with(
            self.repo.name, "123456", GitHubReaction.EYES
        )

    @patch("sentry.seer.code_review.webhooks.issue_comment.logger")
    def test_logs_exception_on_api_error(self, mock_logger: MagicMock) -> None:
        mock_client = MagicMock()
        mock_client.create_comment_reaction.side_effect = Exception("API Error")
        mock_installation = MagicMock()
        mock_installation.get_client.return_value = mock_client
        mock_integration = MagicMock()
        mock_integration.get_installation.return_value = mock_installation

        _add_eyes_reaction_to_comment(
            github_event=GithubWebhookType.ISSUE_COMMENT,
            github_event_action="created",
            integration=mock_integration,
            organization=self.organization,
            repo=self.repo,
            comment_id="123456",
        )

        mock_logger.exception.assert_called_once()
        assert "reaction-failed" in mock_logger.exception.call_args[0][0]
