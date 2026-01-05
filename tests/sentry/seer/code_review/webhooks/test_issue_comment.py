from collections.abc import Generator
from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.http.response import HttpResponseBase

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.webhooks.issue_comment import SENTRY_REVIEW_COMMAND
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class IssueCommentEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub issue_comment webhook events."""

    @pytest.fixture(autouse=True)
    def mock_github_api_calls(self) -> Generator[None]:
        """
        Prevents real HTTP requests to GitHub API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        mock_client_instance = MagicMock()
        mock_client_instance.get_pull_request.return_value = {"head": {"sha": "abc123"}}

        with (
            patch(
                "sentry.integrations.github.client.GitHubApiClient.create_comment_reaction"
            ) as mock_reaction,
            patch(
                "sentry.seer.code_review.utils.GitHubApiClient", return_value=mock_client_instance
            ) as mock_api_client,
        ):
            self.mock_reaction = mock_reaction
            self.mock_api_client = mock_api_client
            yield

    def _send_issue_comment_event(self, event_data: bytes | str) -> HttpResponseBase:
        return self._send_webhook_event(GithubWebhookType.ISSUE_COMMENT, event_data)

    def _build_issue_comment_event(
        self, comment_body: str, comment_id: int | None = 123456789
    ) -> bytes:
        event = {
            "action": "created",
            "comment": {
                "body": comment_body,
                "id": comment_id,
            },
            "issue": {
                "number": 42,
                "pull_request": {"url": "https://api.github.com/repos/owner/repo/pulls/42"},
            },
            "repository": {
                "id": 12345,
                "full_name": "owner/repo",
                "html_url": "https://github.com/owner/repo",
            },
        }
        return orjson.dumps(event)

    @patch("sentry.seer.code_review.webhooks.task.schedule_task")
    def test_skips_when_code_review_not_enabled(self, mock_schedule: MagicMock) -> None:
        event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")
        self._send_issue_comment_event(event)
        mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.task.schedule_task")
    def test_skips_when_no_review_command(self, mock_schedule: MagicMock) -> None:
        with self.code_review_setup():
            event = self._build_issue_comment_event("This is a regular comment without the command")
            self._send_issue_comment_event(event)
            mock_schedule.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.task.schedule_task")
    def test_runs_when_code_review_beta_flag_disabled_but_pr_review_test_generation_enabled(
        self, mock_schedule: MagicMock
    ) -> None:
        with self.code_review_setup(features={"organizations:gen-ai-features"}):
            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")
            self._send_issue_comment_event(event)
            mock_schedule.assert_called_once()

    @patch("sentry.seer.code_review.webhooks.task.make_seer_request")
    @patch("sentry.seer.code_review.utils.GitHubApiClient")
    @patch("sentry.integrations.github.client.GitHubApiClient.create_comment_reaction")
    def test_adds_reaction_and_forwards_when_valid(
        self, mock_create_reaction: MagicMock, mock_api_client: MagicMock, mock_seer: MagicMock
    ) -> None:
        with self.code_review_setup():
            mock_client_instance = MagicMock()
            mock_client_instance.get_pull_request.return_value = {"head": {"sha": "abc123"}}
            mock_api_client.return_value = mock_client_instance

            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")

            with self.tasks():
                self._send_issue_comment_event(event)

            mock_create_reaction.assert_called_once()
            mock_seer.assert_called_once()

    @patch("sentry.seer.code_review.utils.GitHubApiClient")
    @patch("sentry.seer.code_review.webhooks.issue_comment._add_eyes_reaction_to_comment")
    @patch("sentry.seer.code_review.webhooks.task.schedule_task")
    def test_skips_reaction_when_no_comment_id(
        self, mock_schedule: MagicMock, mock_reaction: MagicMock, mock_api_client: MagicMock
    ) -> None:
        with self.code_review_setup():
            mock_client_instance = MagicMock()
            mock_client_instance.get_pull_request.return_value = {"head": {"sha": "abc123"}}
            mock_api_client.return_value = mock_client_instance

            event = self._build_issue_comment_event(SENTRY_REVIEW_COMMAND, comment_id=None)
            self._send_issue_comment_event(event)

            mock_reaction.assert_not_called()
            mock_schedule.assert_called_once()

    @patch("sentry.seer.code_review.webhooks.issue_comment._add_eyes_reaction_to_comment")
    @patch("sentry.seer.code_review.webhooks.task.schedule_task")
    def test_skips_processing_when_option_is_true(
        self, mock_schedule: MagicMock, mock_reaction: MagicMock
    ) -> None:
        """Test that when github.webhook.issue-comment option is True (default), no processing occurs."""
        with self.code_review_setup():
            with self.options({"github.webhook.issue-comment": True}):
                event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")
                self._send_issue_comment_event(event)

            mock_reaction.assert_not_called()
            mock_schedule.assert_not_called()
