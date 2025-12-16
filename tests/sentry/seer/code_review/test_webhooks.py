from unittest.mock import MagicMock, patch

import orjson
from rest_framework.response import Response
from urllib3 import BaseHTTPResponse

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.github import GitHubWebhookTestCase


class CheckRunEventWebhookTest(GitHubWebhookTestCase):
    """Integration tests for GitHub check_run webhook events."""

    def _mock_response(self, status: int, data: bytes) -> BaseHTTPResponse:
        """Helper to create mock urllib3 response."""
        mock_response = MagicMock(spec=BaseHTTPResponse)
        mock_response.status = status
        mock_response.data = data
        return mock_response

    def _send_check_run_event(self, event_data: bytes | str) -> Response:
        """Helper to send check_run event."""
        repo_id = event_data["repository"]["id"]
        integration = self.create_github_integration()
        # Create a repository that matches the fixture's repository.id (35129377)
        self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=repo_id,
            integration_id=integration.id,
        )
        response = self.send_github_webhook_event("check_run", event_data)
        assert response.status_code == 204
        return response

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    def test_check_run_skips_when_ai_features_disabled(self, mock_request: MagicMock) -> None:
        """Test that the handler returns early when AI features are not enabled."""
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        mock_request.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_skips_when_option_disabled(self, mock_request: MagicMock) -> None:
        """Test that handler returns early since the option is disabled by default."""
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        mock_request.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_rerequested_forwards_to_seer(self, mock_request: MagicMock) -> None:
        """Test that rerequested action forwards original_run_id to Seer."""
        mock_request.return_value = self._mock_response(200, b'{"success": true}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

            # Verify request was made with correct payload
            mock_request.assert_called_once()
            call_kwargs = mock_request.call_args[1]
            body = orjson.loads(call_kwargs["body"])
            assert body == {"original_run_id": 4663713}
            assert call_kwargs["path"] == "/v1/automation/codegen/pr-review/rerun"

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_fails_when_external_id_missing(self, mock_request: MagicMock) -> None:
        """Test that missing external_id is handled gracefully."""
        # Create event without external_id
        event_without_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        del event_without_external_id["check_run"]["external_id"]

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(orjson.dumps(event_without_external_id))

                # Verify NO request was made to Seer
                mock_request.assert_not_called()
                # Verify warning was logged
                mock_logger.warning.assert_called_once()
                assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_fails_when_external_id_not_numeric(self, mock_request: MagicMock) -> None:
        """Test that non-numeric external_id is handled gracefully."""
        # Create event with non-numeric external_id
        event_with_invalid_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        event_with_invalid_external_id["check_run"]["external_id"] = "not-a-number"

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(orjson.dumps(event_with_invalid_external_id))

                # Verify NO request was made to Seer
                mock_request.assert_not_called()
                # Verify warning was logged
                mock_logger.warning.assert_called_once()
                assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_handles_seer_error_gracefully(self, mock_request: MagicMock) -> None:
        """Test that Seer errors are caught and logged without failing the webhook."""
        # Mock Seer API to return an error
        mock_request.return_value = self._mock_response(500, b'{"error": "Internal server error"}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

                # Verify the request was attempted
                mock_request.assert_called_once()
                # Verify error logging (not exception since we now handle the status code)
                mock_logger.error.assert_called_once()
                assert "forward.error" in mock_logger.error.call_args[0][0]

    @patch("sentry.seer.code_review.webhooks.make_signed_seer_api_request")
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_includes_signed_headers(self, mock_request: MagicMock) -> None:
        """Test that request is made through make_signed_seer_api_request which handles signing."""
        mock_request.return_value = self._mock_response(200, b'{"success": true}')

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

            # Verify request was made (signing is handled by make_signed_seer_api_request)
            mock_request.assert_called_once()
            # Verify the correct connection pool and path were used
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs["path"] == "/v1/automation/codegen/pr-review/rerun"
            assert "body" in call_kwargs

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        # Don't create an integration, just send the event
        response = self.send_github_webhook_event("check_run", CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        # Should still return 204 even without integration
        assert response.status_code == 204
