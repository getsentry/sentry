from collections.abc import Generator
from datetime import datetime, timezone
from typing import Any
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

    OPTIONS_TO_SET: dict[str, object] = {}

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
                "sentry.integrations.github.client.GitHubApiClient.get_pull_request",
                mock_client_instance.get_pull_request,
            ) as mock_get_pull_request,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_issue_reactions"
            ) as mock_get_issue_reactions,
        ):
            mock_get_issue_reactions.return_value = []
            self.mock_reaction = mock_reaction
            self.mock_get_pull_request = mock_get_pull_request
            self.mock_get_issue_reactions = mock_get_issue_reactions
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
        is_pr_comment: bool = True,
    ) -> bytes:
        event: dict[str, Any] = {
            "action": "created",
            "comment": {
                "body": comment_body,
                "id": comment_id,
                "created_at": "2024-01-15T10:30:00Z",
            },
            "issue": {
                "number": 42,
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
        if is_pr_comment:
            issue: dict[str, Any] = event["issue"]
            issue["pull_request"] = {
                "url": f"https://api.github.com/repos/{github_org}/repo/pulls/42"
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

    @patch(
        "sentry.seer.code_review.webhooks.issue_comment.delete_existing_reactions_and_add_eyes_reaction"
    )
    def test_skips_reaction_when_no_comment_id(self, mock_reaction: MagicMock) -> None:
        """Test that reaction is skipped when comment has no ID, but processing continues."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(SENTRY_REVIEW_COMMAND, comment_id=None)

            response = self._send_issue_comment_event(event)
            assert response.status_code == 204

            mock_reaction.assert_not_called()
            self.mock_seer.assert_called_once()

    def test_skips_when_not_pr_comment(self) -> None:
        """Test that processing is skipped when comment is not on a PR."""
        with self.code_review_setup(), self.tasks():
            event = self._build_issue_comment_event(SENTRY_REVIEW_COMMAND, is_pr_comment=False)
            response = self._send_issue_comment_event(event)
            assert response.status_code == 204
            self.mock_seer.assert_not_called()

    def test_success_case(self) -> None:
        """Test that Seer request includes trigger metadata from the comment."""
        with self.code_review_setup(), self.tasks():
            event_dict = orjson.loads(
                self._build_issue_comment_event(f"Please {SENTRY_REVIEW_COMMAND} this PR")
            )
            event_dict["comment"]["user"] = {"login": "test-user"}
            event = orjson.dumps(event_dict)

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
            assert payload["data"]["config"]["trigger_user"] == "test-user"
            assert payload["data"]["config"]["trigger_comment_id"] == 123456789
            assert payload["data"]["config"]["trigger_comment_type"] == "issue_comment"
            # After Pydantic validation, trigger_at is a datetime object
            assert payload["data"]["config"]["trigger_at"] == datetime(
                2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc
            )
            # sentry_received_trigger_at is set to current time when transform happens
            assert isinstance(payload["data"]["config"]["sentry_received_trigger_at"], datetime)
