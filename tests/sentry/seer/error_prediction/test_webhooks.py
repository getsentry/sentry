from unittest.mock import MagicMock, patch

import orjson
import responses
from django.conf import settings
from rest_framework.response import Response

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.seer.error_prediction.webhooks import (
    SEER_PR_REVIEW_RERUN_PATH,
    handle_github_check_run_event,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.github import GitHubWebhookTestCase


class HandleGithubCheckRunEventTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.action_rerequested_event = {
            "action": "rerequested",
            "check_run": {
                "external_id": "4663713",
                "html_url": "https://github.com/test/repo/runs/4",
            },
        }

    def test_skips_when_prevent_ai_features_disabled(self):
        """Test that the handler returns early when AI features are not enabled."""
        # Without enabling feature flags, can_use_prevent_ai_features returns False
        success = handle_github_check_run_event(
            self.organization,
            event=self.action_rerequested_event,
        )
        assert not success

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_skips_non_handled_actions(self):
        """Test that non-handled actions are skipped."""
        non_handled_actions = ["created", "completed", "requested_action", None]

        for action in non_handled_actions:
            event = {
                "action": action,
                "check_run": {
                    "external_id": "4663713",
                    "html_url": "https://github.com/test/repo/runs/4",
                },
            }
            success = handle_github_check_run_event(self.organization, event)
            assert not success

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_skips_when_option_disabled(self):
        """Test that handler returns early when the option is disabled."""
        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": False}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert not success

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_forwards_rerequested_action_to_seer(self):
        """Test that rerequested action forwards original_run_id to Seer."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"success": True},
            status=200,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert success

            # Verify request was made with correct payload
            assert len(responses.calls) == 1
            body = orjson.loads(responses.calls[0].request.body)
            assert body == {"original_run_id": 4663713}

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_fails_when_external_id_missing(self):
        """Test that missing external_id returns False."""
        event = {
            "action": "rerequested",
            "check_run": {"html_url": "https://github.com/test/repo/runs/4"},
        }

        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            success = handle_github_check_run_event(self.organization, event)
            assert not success
            mock_logger.warning.assert_called_once()
            assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_fails_when_external_id_not_numeric(self):
        """Test that non-numeric external_id returns False."""
        event = {
            "action": "rerequested",
            "check_run": {"external_id": "not-a-number"},
        }

        with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
            success = handle_github_check_run_event(self.organization, event)
            assert not success
            mock_logger.warning.assert_called_once()
            assert "missing_external_id" in mock_logger.warning.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_handles_seer_error_response(self):
        """Test that Seer errors are caught and logged."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"error": "Internal server error"},
            status=500,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            with patch("sentry.seer.error_prediction.webhooks.logger") as mock_logger:
                success = handle_github_check_run_event(
                    self.organization,
                    event=self.action_rerequested_event,
                )
                assert not success
                # Verify exception logging
                mock_logger.exception.assert_called_once()
                assert "forward.exception" in mock_logger.exception.call_args[0][0]

    @responses.activate
    @with_feature({"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"})
    def test_includes_signed_headers(self):
        """Test that request includes signed headers for Seer authentication."""
        responses.add(
            responses.POST,
            f"{settings.SEER_AUTOFIX_URL}{SEER_PR_REVIEW_RERUN_PATH}",
            json={"success": True},
            status=200,
        )

        with self.options(
            {"coding_workflows.error_prediction.github.check_run.rerun.enabled": True}
        ):
            success = handle_github_check_run_event(
                self.organization,
                event=self.action_rerequested_event,
            )
            assert success

            # Verify request has content-type header
            request = responses.calls[0].request
            assert request.headers["content-type"] == "application/json;charset=utf-8"


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
