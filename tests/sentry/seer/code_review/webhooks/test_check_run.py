from unittest.mock import MagicMock, patch

import orjson

from fixtures.github import (
    CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
    CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
)
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.webhooks.check_run import GitHubCheckRunAction
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class CheckRunEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub check_run webhook events."""

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_base_case(self, mock_task: MagicMock) -> None:
        """Test that rerequested action enqueues task with correct parameters."""
        with self.code_review_setup():
            self._send_webhook_event(
                GithubWebhookType.CHECK_RUN,
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            )

            mock_task.delay.assert_called_once()
            call_kwargs = mock_task.delay.call_args[1]
            assert call_kwargs["github_event"] == GithubWebhookType.CHECK_RUN
            assert (
                call_kwargs["event_payload"]["original_run_id"]
                == self.event_dict["check_run"]["external_id"]
            )

            assert call_kwargs["action"] == GitHubCheckRunAction.REREQUESTED.value
            assert call_kwargs["html_url"] == self.event_dict["check_run"]["html_url"]
            assert "enqueued_at_str" in call_kwargs
            assert isinstance(call_kwargs["enqueued_at_str"], str)

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_skips_when_ai_features_disabled(self, mock_task: MagicMock) -> None:
        """Test that the handler returns early when AI features are not enabled (even though the option is enabled)."""
        self._send_webhook_event(
            GithubWebhookType.CHECK_RUN,
            CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
        )
        mock_task.delay.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_fails_when_action_missing(self, mock_task: MagicMock) -> None:
        """Test that missing action field is handled gracefully without KeyError."""
        with self.code_review_setup():
            event_without_action = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
            del event_without_action["action"]

            with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
                self._send_webhook_event(
                    GithubWebhookType.CHECK_RUN,
                    orjson.dumps(event_without_action),
                )
                mock_task.delay.assert_not_called()
                mock_logger.error.assert_called_once()
                assert "github.webhook.check_run.missing-action" in str(mock_logger.error.call_args)

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_fails_when_external_id_missing(self, mock_task: MagicMock) -> None:
        """Test that missing external_id is handled gracefully."""
        with self.code_review_setup():
            event_without_external_id = orjson.loads(CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE)
            del event_without_external_id["check_run"]["external_id"]

            with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
                self._send_webhook_event(
                    GithubWebhookType.CHECK_RUN,
                    orjson.dumps(event_without_external_id),
                )
                mock_task.delay.assert_not_called()
                mock_logger.exception.assert_called_once()
                assert (
                    "github.webhook.check_run.invalid-payload"
                    in mock_logger.exception.call_args[0][0]
                )

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_fails_when_external_id_not_numeric(self, mock_task: MagicMock) -> None:
        """Test that non-numeric external_id is handled gracefully."""
        with self.code_review_setup():
            event_with_invalid_external_id = orjson.loads(
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE
            )
            event_with_invalid_external_id["check_run"]["external_id"] = "not-a-number"

            with patch("sentry.seer.code_review.webhooks.check_run.logger") as mock_logger:
                self._send_webhook_event(
                    GithubWebhookType.CHECK_RUN,
                    orjson.dumps(event_with_invalid_external_id),
                )
                mock_task.delay.assert_not_called()
                mock_logger.exception.assert_called_once()
                assert (
                    "github.webhook.check_run.invalid-payload"
                    in mock_logger.exception.call_args[0][0]
                )

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_enqueues_task_for_processing(self, mock_task: MagicMock) -> None:
        """Test that webhook successfully enqueues task for async processing."""
        with self.code_review_setup():
            self._send_webhook_event(
                GithubWebhookType.CHECK_RUN,
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            )

            mock_task.delay.assert_called_once()
            call_kwargs = mock_task.delay.call_args[1]
            assert call_kwargs["github_event"] == GithubWebhookType.CHECK_RUN
            assert (
                call_kwargs["event_payload"]["original_run_id"]
                == self.event_dict["check_run"]["external_id"]
            )

    def test_check_run_without_integration_returns_204(self) -> None:
        """Test that check_run events without integration return 204."""
        response = self.send_github_webhook_event(
            GithubWebhookType.CHECK_RUN,
            CHECK_RUN_COMPLETED_EVENT_EXAMPLE,
        )
        assert response.status_code == 204

    @patch("sentry.seer.code_review.webhooks.task.process_github_webhook_event")
    def test_check_run_runs_when_code_review_beta_flag_disabled_but_pr_review_test_generation_enabled(
        self, mock_task: MagicMock
    ) -> None:
        """Test that task is enqueued when code-review-beta flag is off but pr_review_test_generation is enabled."""
        with self.code_review_setup(features={"organizations:gen-ai-features"}):
            self._send_webhook_event(
                GithubWebhookType.CHECK_RUN,
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            )
            mock_task.delay.assert_called_once()

    @patch("sentry.seer.code_review.utils.make_seer_request")
    def test_check_run_skips_when_hide_ai_features_enabled(
        self, mock_make_seer_request: MagicMock
    ) -> None:
        """Test that task is not enqueued when hide_ai_features option is True."""
        with self.code_review_setup():
            self.organization.update_option("sentry:hide_ai_features", True)
            self._send_webhook_event(
                GithubWebhookType.CHECK_RUN,
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            )
            mock_make_seer_request.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.task.make_seer_request")
    def test_check_run_bypasses_org_whitelist_check(
        self, mock_make_seer_request: MagicMock
    ) -> None:
        """Test that CHECK_RUN events go to Seer even when org is not whitelisted.

        This verifies the bug fix: CHECK_RUN events should bypass the org whitelist
        check because they are user-initiated reruns from GitHub UI.
        """
        with self.code_review_setup(), self.tasks():
            self._send_webhook_event(
                GithubWebhookType.CHECK_RUN,
                CHECK_RUN_REREQUESTED_ACTION_EVENT_EXAMPLE,
            )

            mock_make_seer_request.assert_called_once()
            call_kwargs = mock_make_seer_request.call_args[1]
            assert call_kwargs["path"] == "/v1/automation/codegen/pr-review/rerun"
