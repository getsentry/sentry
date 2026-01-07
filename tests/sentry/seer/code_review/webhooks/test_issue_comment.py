from collections.abc import Generator
from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.http.response import HttpResponseBase

from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.webhooks.issue_comment import SENTRY_REVIEW_COMMAND
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class IssueCommentEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub issue_comment webhook events."""

    OPTIONS_TO_SET = {"github.webhook.issue-comment": False}

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

    @pytest.fixture(autouse=True)
    def mock_seer_request(self) -> Generator[None]:
        """
        Prevents real HTTP requests to Seer API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        with patch("sentry.seer.code_review.webhooks.task.make_seer_request") as mock_seer:
            self.mock_seer = mock_seer
            yield

    def _send_issue_comment_event(self, event_data: bytes | str) -> HttpResponseBase:
        return self._send_webhook_event(GithubWebhookType.ISSUE_COMMENT, event_data)

    def _build_issue_comment_event(
        self,
        comment_body: str,
        comment_id: int | None = 123456789,
        github_org: str = "sentry-ecosystem",
    ) -> bytes:
        event = {
            "action": "created",
            "comment": {
                "body": comment_body,
                "id": comment_id,
            },
            "issue": {
                "number": 42,
                "pull_request": {"url": f"https://api.github.com/repos/{github_org}/repo/pulls/42"},
                "user": {
                    "id": 12345678,
                    "login": "pr-author",
                },
            },
            "repository": {
                "id": 12345,
                "full_name": f"{github_org}/repo",
                "html_url": f"https://github.com/{github_org}/repo",
                "owner": {
                    "login": github_org,
                    "id": 12345,
                },
            },
            "sender": {
                "id": 87654321,
                "login": "commenter",
            },
        }
        return orjson.dumps(event)

    def test_skips_when_code_review_features_are_missing(self) -> None:
        """Test that processing is skipped when code review features are missing."""
        # Missing features on purpose
        with self.code_review_setup(features={}), self.tasks():
            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_seer.assert_not_called()

    def test_skips_when_no_review_command(self) -> None:
        """Test that processing is skipped when comment doesn't contain review command."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event("This is a regular comment without the command")
            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_seer.assert_not_called()

    def test_runs_when_code_review_beta_flag_disabled_but_pr_review_test_generation_enabled(
        self,
    ) -> None:
        """Test that processing runs with gen-ai-features flag alone when org option is enabled."""
        with self.code_review_setup(features={"organizations:gen-ai-features"}), self.tasks():
            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

        self.mock_seer.assert_called_once()

    def test_adds_reaction_and_forwards_when_valid(self) -> None:
        """Test successful PR review command processing with reaction and Seer request."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_reaction.assert_called_once_with(
                "sentry-ecosystem/repo", "123456789", GitHubReaction.EYES
            )
            self.mock_seer.assert_called_once()

            call_args = self.mock_seer.call_args
            assert call_args[1]["path"] == "/v1/automation/overwatch-request"
            payload = call_args[1]["payload"]
            assert payload["request_type"] == "pr-review"
            assert payload["data"]["repo"]["base_commit_sha"] == "abc123"

    @patch("sentry.seer.code_review.webhooks.issue_comment._add_eyes_reaction_to_comment")
    def test_skips_reaction_when_no_comment_id(self, mock_reaction: MagicMock) -> None:
        """Test that reaction is skipped when comment has no ID, but processing continues."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(SENTRY_REVIEW_COMMAND, comment_id=None)

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            mock_reaction.assert_not_called()
            self.mock_seer.assert_called_once()

    def test_validates_seer_request_contains_trigger_metadata(self) -> None:
        """Test that Seer request includes trigger metadata from the comment."""
        with self.code_review_setup(), self.tasks():
            event_dict = orjson.loads(
                self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")
            )
            event_dict["comment"]["user"] = {"login": "test-user"}
            event = orjson.dumps(event_dict)

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_seer.assert_called_once()
            payload = self.mock_seer.call_args[1]["payload"]
            assert payload["data"]["config"]["trigger_user"] == "test-user"
            assert payload["data"]["config"]["trigger_comment_id"] == 123456789
            assert payload["data"]["config"]["trigger_comment_type"] == "issue_comment"

    def test_processes_whitelisted_github_org(self) -> None:
        """Test that whitelisted GitHub organizations are processed."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_reaction.assert_called_once()
            self.mock_seer.assert_called_once()

    def test_skips_non_whitelisted_github_org(self) -> None:
        """Test that non-whitelisted GitHub organizations are skipped."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(
                f"Please {SENTRY_REVIEW_COMMAND} this PR", github_org="random-org"
            )

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            self.mock_reaction.assert_not_called()
            self.mock_seer.assert_not_called()
