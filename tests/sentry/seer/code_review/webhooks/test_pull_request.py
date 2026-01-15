from collections.abc import Generator
from unittest.mock import MagicMock, patch

import orjson
import pytest

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.utils import RequestType
from sentry.testutils.helpers.github import GitHubWebhookCodeReviewTestCase


class PullRequestEventWebhookTest(GitHubWebhookCodeReviewTestCase):
    """Integration tests for GitHub pull_request webhook events."""

    OPTIONS_TO_SET = {
        "seer.code-review.direct-to-seer-enabled-gh-orgs": ["sentry-ecosystem"],
    }

    @pytest.fixture(autouse=True)
    def mock_github_api_calls(self) -> Generator[None]:
        """
        Prevents real HTTP requests to GitHub API across all tests.
        Uses autouse fixture to apply mocking automatically without @patch decorators on each test.
        """
        mock_client_instance = MagicMock()
        mock_client_instance.get_pull_request.return_value = {"head": {"sha": "abc123"}}

        with patch(
            "sentry.integrations.github.client.GitHubApiClient.get_pull_request",
            mock_client_instance.get_pull_request,
        ) as mock_get_pull_request:
            self.mock_get_pull_request = mock_get_pull_request
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
        """Test that opened action triggers Seer request."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            assert event["action"] == "opened"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
            call_kwargs = self.mock_seer.call_args[1]
            assert call_kwargs["path"] == "/v1/automation/overwatch-request"
            payload = call_kwargs["payload"]
            assert payload["request_type"] == RequestType.PR_REVIEW.value

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
        """Test that ready_for_review action triggers Seer request."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "ready_for_review"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()

    def test_pull_request_reopened_action(self) -> None:
        """Test that reopened action is skipped (not in whitelist)."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "reopened"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_synchronize_action(self) -> None:
        """Test that synchronize action triggers Seer request."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["action"] = "synchronize"
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()

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

    def test_pull_request_processes_whitelisted_github_org(self) -> None:
        """Test that whitelisted GitHub organizations are processed."""
        with self.code_review_setup(), self.tasks():
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            event["repository"]["owner"]["login"] = "sentry-ecosystem"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()

    def test_pull_request_skips_non_whitelisted_github_org(self) -> None:
        """Test that non-whitelisted GitHub organizations are skipped when region is not in direct-to-seer list."""
        # "baxterthehacker" is the default and is not whitelisted; region "de" is not in the direct-to-seer list.
        mock_region = MagicMock()
        mock_region.name = "de"

        with (
            self.code_review_setup(),
            self.tasks(),
            patch("sentry.seer.code_review.utils.get_local_region", return_value=mock_region),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            assert event["repository"]["owner"]["login"] == "baxterthehacker"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_not_called()

    def test_pull_request_processes_when_region_is_direct_to_seer(self) -> None:
        """Test that non-whitelisted orgs are processed when region is in direct-to-seer list."""
        mock_region = MagicMock()
        mock_region.name = "test-region"

        with (
            self.code_review_setup(
                options={"seer.code-review.direct-to-seer-regions.pull-request": ["test-region"]}
            ),
            self.tasks(),
            patch("sentry.seer.code_review.utils.get_local_region", return_value=mock_region),
        ):
            event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
            # "baxterthehacker" is the default in the fixture and is not whitelisted
            assert event["repository"]["owner"]["login"] == "baxterthehacker"

            self._send_webhook_event(
                GithubWebhookType.PULL_REQUEST,
                orjson.dumps(event),
            )

            self.mock_seer.assert_called_once()
