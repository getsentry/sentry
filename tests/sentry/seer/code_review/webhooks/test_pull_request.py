from collections.abc import Generator
from unittest.mock import patch

import orjson
import pytest

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.models import SeerCodeReviewRequestType, SeerCodeReviewTrigger
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class PullRequestEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub pull_request webhook events."""

    OPTIONS_TO_SET: dict[str, object] = {}

    @pytest.fixture(autouse=True)
    def mock_github_api_calls(self) -> Generator[None]:
        """
        Prevents real HTTP requests to GitHub API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        with (
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_pull_request"
            ) as mock_get_pull_request,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.create_issue_reaction"
            ) as mock_reaction,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.get_issue_reactions"
            ) as mock_get_reactions,
            patch(
                "sentry.integrations.github.client.GitHubApiClient.delete_issue_reaction"
            ) as mock_delete_reaction,
        ):
            mock_get_pull_request.return_value = {"head": {"sha": "abc123"}}
            mock_get_reactions.return_value = [
                {"id": 2, "user": {"login": "other-user"}, "content": "heart"}
            ]

            self.mock_get_pull_request = mock_get_pull_request
            self.mock_reaction = mock_reaction
            self.mock_get_reactions = mock_get_reactions
            self.mock_delete_reaction = mock_delete_reaction
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

    def test_pull_request_opened(self) -> None:
        """Test that opened action triggers Seer request and adds reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            assert event["action"] == "opened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            assert call_kwargs["path"] == "/v1/automation/overwatch-request"
            payload = call_kwargs["payload"]
            assert payload["request_type"] == SeerCodeReviewRequestType.PR_REVIEW.value

            self.mock_reaction.assert_called_once_with(
                event["repository"]["full_name"],
                str(event["pull_request"]["number"]),
                GitHubReaction.EYES,
            )

    def test_pull_request_skips_draft(self) -> None:
        """Test that draft PRs are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_draft = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_draft["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_draft),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()

    def test_pull_request_skips_unsupported_action(self) -> None:
        """Test that unsupported actions are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_unsupported_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_unsupported_action["action"] = "assigned"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_unsupported_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_missing_action_field(self) -> None:
        """Test that events without action field are skipped."""
        with self.code_review_setup(), self.tasks():
            event_without_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            del event_without_action["action"]

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_without_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_invalid_action_type(self) -> None:
        """Test that events with non-string action are skipped."""
        with self.code_review_setup(), self.tasks():
            event_with_invalid_action = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event_with_invalid_action["action"] = 123

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event_with_invalid_action),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_skips_when_code_review_disabled(self) -> None:
        """Test that PR events are skipped when code review features are not enabled."""
        with self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_ready_for_review_action(self) -> None:
        """Test that ready_for_review action triggers Seer request and adds reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            self.mock_reaction.assert_called_once()

    def test_pull_request_reopened_action(self) -> None:
        """Test that reopened action is skipped (not in whitelisted actions)."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "reopened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_synchronize_action(self) -> None:
        """Test that synchronize action triggers Seer request and adds reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            self.mock_reaction.assert_called_once()

    def test_pull_request_invalid_enum_action(self) -> None:
        """Test that actions not in PullRequestAction enum are handled gracefully."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "future_action_not_in_enum"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_blocks_draft_for_ready_for_review_action(self) -> None:
        """Test that draft PRs are blocked for ready_for_review action."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()
            self.mock_reaction.assert_not_called()

    def test_pull_request_blocks_draft_for_synchronize_action(self) -> None:
        """Test that draft PRs are blocked for synchronize action."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"
            event["pull_request"]["draft"] = True

            response = self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            assert response.status_code == 204
            self.mock_seer.assert_not_called()
            self.mock_reaction.assert_not_called()

    def test_pull_request_closed_action(self) -> None:
        """Test that closed action triggers Seer request with pr-closed request type and skips reaction."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            assert call_kwargs["path"] == "/v1/automation/overwatch-request"
            payload = call_kwargs["payload"]
            assert payload["request_type"] == SeerCodeReviewRequestType.PR_CLOSED.value
            assert payload["data"]["config"]["trigger"] == SeerCodeReviewTrigger.UNKNOWN.value
            assert payload["data"]["config"]["trigger_user"] == "baxterthehacker"
            assert payload["data"]["config"]["trigger_comment_id"] is None
            assert payload["data"]["config"]["trigger_comment_type"] is None
            self.mock_reaction.assert_not_called()

    def test_pull_request_opened_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_NEW_COMMIT]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "opened"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_synchronize_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_ready_for_review_filtered_when_trigger_disabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_NEW_COMMIT]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_not_called()

    def test_pull_request_closed_bypasses_trigger_check_post_ga(self) -> None:
        triggers: list[CodeReviewTrigger] = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_opened_works_when_trigger_enabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "opened"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_ready_for_review_works_when_trigger_enabled_post_ga(self) -> None:
        triggers = [CodeReviewTrigger.ON_READY_FOR_REVIEW]
        features = {"organizations:gen-ai-features", "organizations:seat-based-seer-enabled"}
        org_options = {"sentry:enable_pr_review_test_generation": False}
        with (
            self.code_review_setup(triggers=triggers, features=features, org_options=org_options),
            self.tasks(),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(GithubWebhookType.PULL_REQUEST, orjson.dumps(event))

            self.mock_seer.assert_called_once()

    def test_pull_request_closed_draft_still_sends_to_seer(self) -> None:
        """Test that closed draft PRs still send cleanup notifications to Seer.

        This prevents orphaned state in Seer when a PR is:
        1. Opened as non-draft (Seer notified)
        2. Converted to draft
        3. Closed while draft (Seer must be notified to cleanup state)
        """
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "closed"
            event["pull_request"]["draft"] = True
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            # Should still call Seer even though PR is draft
            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            payload = call_kwargs["payload"]
            assert payload["request_type"] == SeerCodeReviewRequestType.PR_CLOSED.value
