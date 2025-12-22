from unittest.mock import MagicMock, patch

import orjson
from django.http.response import HttpResponseBase

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.github import GitHubWebhookTestCase


class CheckRunEventWebhookTest(GitHubWebhookTestCase):
    """Integration tests for GitHub check_run webhook events."""

    def _enable_code_review(self) -> None:
        """Enable all required options for code review to work."""
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

    def _send_check_run_event(self, event_data: bytes | str) -> HttpResponseBase:
        """Helper to send check_run event with Pydantic validation."""
        self.event_dict = (
            orjson.loads(event_data) if isinstance(event_data, (bytes, str)) else event_data
        )
        repo_id = int(self.event_dict["repository"]["id"])

        integration = self.create_github_integration()
        self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=repo_id,
            integration_id=integration.id,
        )
        response = self.send_github_webhook_event("check_run", event_data)
        assert response.status_code == 204
        return response

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_base_case(self, mock_task: MagicMock) -> None:
        """Test that rerequested action enqueues task with correct parameters."""
        self._enable_code_review()
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args[1]
        assert call_kwargs["event_type"] == "check_run"
        assert call_kwargs["original_run_id"] == self.event_dict["check_run"]["external_id"]
        assert call_kwargs["action"] == "rerequested"
        assert call_kwargs["html_url"] == self.event_dict["check_run"]["html_url"]
        assert "enqueued_at_str" in call_kwargs
        assert isinstance(call_kwargs["enqueued_at_str"], str)

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    def test_check_run_skips_when_ai_features_disabled(self, mock_task: MagicMock) -> None:
        """Test that the handler returns early when AI features are not enabled (even though the option is enabled)."""
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        mock_task.delay.assert_not_called()

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_check_run_fails_when_action_missing(self, mock_task: MagicMock) -> None:
        """Test that missing action field is handled gracefully without KeyError."""
        self._enable_code_review()
        event_without_action = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        del event_without_action["action"]

        with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
            self._send_check_run_event(orjson.dumps(event_without_action))
            mock_task.delay.assert_not_called()
            mock_logger.error.assert_called_once()
            assert "github.webhook.check_run.missing-action" in str(mock_logger.error.call_args)

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_check_run_fails_when_external_id_missing(self, mock_task: MagicMock) -> None:
        """Test that missing external_id is handled gracefully."""
        self._enable_code_review()
        event_without_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        del event_without_external_id["check_run"]["external_id"]

        with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
            self._send_check_run_event(orjson.dumps(event_without_external_id))
            mock_task.delay.assert_not_called()
            mock_logger.exception.assert_called_once()
            assert (
                "github.webhook.check_run.invalid-payload" in mock_logger.exception.call_args[0][0]
            )

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_check_run_fails_when_external_id_not_numeric(self, mock_task: MagicMock) -> None:
        """Test that non-numeric external_id is handled gracefully."""
        self._enable_code_review()
        event_with_invalid_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        event_with_invalid_external_id["check_run"]["external_id"] = "not-a-number"

        with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
            self._send_check_run_event(orjson.dumps(event_with_invalid_external_id))
            mock_task.delay.assert_not_called()
            mock_logger.exception.assert_called_once()
            assert (
                "github.webhook.check_run.invalid-payload" in mock_logger.exception.call_args[0][0]
            )

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_check_run_enqueues_task_for_processing(self, mock_task: MagicMock) -> None:
        """Test that webhook successfully enqueues task for async processing."""
        self._enable_code_review()
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args[1]
        assert call_kwargs["event_type"] == "check_run"
        assert call_kwargs["original_run_id"] == self.event_dict["check_run"]["external_id"]

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        response = self.send_github_webhook_event("check_run", CHECK_RUN_COMPLETED_EVENT_EXAMPLE)
        assert response.status_code == 204

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features"})
    def test_check_run_skips_when_code_review_beta_flag_disabled(
        self, mock_task: MagicMock
    ) -> None:
        """Test that task is not enqueued when code-review-beta flag is off."""
        self._enable_code_review()
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        mock_task.delay.assert_not_called()

    @patch("sentry.seer.code_review.webhook_task.process_github_webhook_event")
    @with_feature({"organizations:gen-ai-features", "organizations:code-review-beta"})
    def test_check_run_skips_when_hide_ai_features_enabled(self, mock_task: MagicMock) -> None:
        """Test that task is not enqueued when hide_ai_features option is True."""
        self._enable_code_review()
        self.organization.update_option("sentry:hide_ai_features", True)
        self._send_check_run_event(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
        mock_task.delay.assert_not_called()
