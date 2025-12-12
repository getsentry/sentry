from unittest.mock import MagicMock, patch

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
    def _send_check_run_event(self, event_data: bytes | str) -> Response:
        """Helper to send check_run event."""
        self.create_github_integration()
        response = self.send_github_webhook_event("check_run", event_data)
        assert response.status_code == 204
        return response

    @patch("sentry.integrations.github.webhook.CheckRunEventWebhook.__call__")
    def test_check_run_requested_action_event_triggers_handler(
        self, mock_event_handler: MagicMock
    ) -> None:
        """Test that check_run requested_action events trigger the webhook handler."""
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        assert mock_event_handler.called

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_rerequested_forwards_to_seer(self) -> None:
        """Test that rerequested check_run events forward original_run_id to Seer."""
        # Mock the Seer API endpoint
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

        # Verify the request was made to Seer
        assert len(responses.calls) == 1
        request = responses.calls[0].request

        # Verify request body contains original_run_id extracted from external_id
        body = orjson.loads(request.body)
        assert body == {"original_run_id": 4663713}

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_completed_is_skipped(self) -> None:
        """Test that completed check_run events are skipped (not handled)."""
        # Mock the Seer API endpoint (should NOT be called)
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"success": True},
            status=200,
        )

        self._send_check_run_event(CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        # Verify NO request was made to Seer (completed action is not handled)
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_check_run_handles_seer_error_gracefully(self) -> None:
        """Test that Seer API errors are caught and logged without failing the webhook."""
        # Mock Seer API to return an error
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codegen/pr-review/rerun",
            json={"error": "Internal server error"},
            status=500,
        )

        # Should not raise an exception, just log it
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

        # Verify the request was attempted
        assert len(responses.calls) == 1

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        # Don't create an integration, just send the event
        response = self.send_github_webhook_event("check_run", CHECK_RUN_COMPLETED_EVENT_EXAMPLE)

        # Should still return 204 even without integration
        assert response.status_code == 204
