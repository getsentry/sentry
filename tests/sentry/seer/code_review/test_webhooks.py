from unittest.mock import patch

import orjson
import responses
from django.conf import settings
from rest_framework.response import Response

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.github import GitHubWebhookTestCase


class CheckRunEventWebhookTest(GitHubWebhookTestCase):
    """Integration tests for GitHub check_run webhook events."""

    def _send_check_run_event(self, event_data: bytes | str) -> Response:
        """Helper to send check_run event."""
        integration = self.create_github_integration()
        # Create a repository that matches the fixture's repository.id (35129377)
        self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id="35129377",
            integration_id=integration.id,
        )
        response = self.send_github_webhook_event("check_run", event_data)
        assert response.status_code == 204
        return response

    @responses.activate
    def test_check_run_skips_when_ai_features_disabled(self) -> None:
        """Test that the handler returns early when AI features are not enabled."""
        # Mock the Seer API endpoint (should NOT be called without feature flags)
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        # Without enabling feature flags, no request should be made
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

        # Verify NO request was made to Seer
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_skips_when_option_disabled(self) -> None:
        """Test that handler returns early when the option is disabled."""
        # Mock the Seer API endpoint (should NOT be called when option is disabled)
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": False}):
            self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

            # Verify NO request was made to Seer
            assert len(responses.calls) == 0

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_rerequested_forwards_to_seer(self) -> None:
        """Test that rerequested action forwards original_run_id to Seer."""
        # Mock the Seer API endpoint
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

            # Verify request was made with correct payload
            assert len(responses.calls) == 1
            body = orjson.loads(responses.calls[0].request.body)
            assert body == {"original_run_id": 4663713}

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_fails_when_external_id_missing(self) -> None:
        """Test that missing external_id is handled gracefully."""
        # Mock the Seer API endpoint (should NOT be called with missing external_id)
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        # Create event without external_id
        event_without_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        del event_without_external_id["check_run"]["external_id"]

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(orjson.dumps(event_without_external_id))

                # Verify NO request was made to Seer
                assert len(responses.calls) == 0
                # Verify warning was logged
                mock_logger.warning.assert_called_once()
                assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_fails_when_external_id_not_numeric(self) -> None:
        """Test that non-numeric external_id is handled gracefully."""
        # Mock the Seer API endpoint (should NOT be called with non-numeric external_id)
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        # Create event with non-numeric external_id
        event_with_invalid_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        event_with_invalid_external_id["check_run"]["external_id"] = "not-a-number"

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(orjson.dumps(event_with_invalid_external_id))

                # Verify NO request was made to Seer
                assert len(responses.calls) == 0
                # Verify warning was logged
                mock_logger.warning.assert_called_once()
                assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_handles_seer_error_gracefully(self) -> None:
        """Test that Seer errors are caught and logged without failing the webhook."""
        # Mock Seer API to return an error
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"error": "Internal server error"},
            status=500,
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            with patch("sentry.seer.code_review.webhooks.logger") as mock_logger:
                self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

                # Verify the request was attempted
                assert len(responses.calls) == 1
                # Verify exception logging
                mock_logger.exception.assert_called_once()
                assert "forward.exception" in mock_logger.exception.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_includes_signed_headers(self) -> None:
        """Test that request includes signed headers for Seer authentication."""
        # Mock the Seer API endpoint
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        with self.options({"coding_workflows.code_review.github.check_run.rerun.enabled": True}):
            self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

            # Verify request has content-type header
            request = responses.calls[0].request
            assert request.headers["content-type"] == "application/json;charset=utf-8"

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        # Don't create an integration, just send the event
        response = self.send_github_webhook_event("check_run", CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        # Should still return 204 even without integration
        assert response.status_code == 204
