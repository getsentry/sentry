from collections.abc import Generator
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.types import IntegrationProviderSlug
from sentry.seer.code_review.webhooks.handlers import (
    WEBHOOK_SEEN_KEY_PREFIX,
    WEBHOOK_SEEN_TTL_SECONDS,
    handle_webhook_event,
)
from sentry.testutils.cases import TestCase
from sentry.utils.redis import redis_clusters


class TestHandleWebhookEvent(TestCase):
    """Unit tests for handle_webhook_event."""

    @patch("sentry.seer.code_review.webhooks.handlers.CodeReviewPreflightService")
    def test_skips_github_enterprise_on_prem(self, mock_preflight: MagicMock) -> None:
        """
        Test that GitHub Enterprise on-prem webhooks are skipped.

        Code review is only supported for GitHub Cloud, not GitHub Enterprise Server.
        """
        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB_ENTERPRISE

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "opened", "pull_request": {}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        # Preflight should never be called for GitHub Enterprise
        mock_preflight.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.handlers.CodeReviewPreflightService")
    def test_processes_github_com(self, mock_preflight: MagicMock) -> None:
        """Test that GitHub Cloud webhooks are processed normally."""
        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123

        mock_preflight_instance = MagicMock()
        mock_preflight_instance.check.return_value.allowed = False
        mock_preflight_instance.check.return_value.denial_reason = None
        mock_preflight.return_value = mock_preflight_instance

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "opened", "pull_request": {}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        # Preflight should be called for GitHub Cloud
        mock_preflight.assert_called_once()


class TestHandleWebhookEventWebhookSeen(TestCase):
    @pytest.fixture(autouse=True)
    def mock_preflight_allowed(self) -> Generator[None]:
        with patch(
            "sentry.seer.code_review.webhooks.handlers.CodeReviewPreflightService"
        ) as mock_preflight:
            mock_preflight.return_value.check.return_value.allowed = True
            mock_preflight.return_value.check.return_value.denial_reason = None
            mock_preflight.return_value.check.return_value.settings = None
            yield

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_webhook_already_seen_handler_not_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """
        When the delivery_id was already seen, handle_webhook_event returns without invoking the handler.
        """
        delivery_id = f"already-seen-{uuid4()}"
        cluster = redis_clusters.get("default")
        seen_key = f"{WEBHOOK_SEEN_KEY_PREFIX}{delivery_id}"
        cluster.set(seen_key, "1", ex=WEBHOOK_SEEN_TTL_SECONDS, nx=True)

        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event={"action": "opened", "pull_request": {"number": 1, "draft": False}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        mock_pull_request_handler.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_webhook_first_time_seen_handler_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """When the delivery_id is not yet seen, handle_webhook_event marks it seen and invokes the handler."""
        delivery_id = f"seen-success-{uuid4()}"

        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event={"action": "opened", "pull_request": {"number": 1, "draft": False}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        mock_pull_request_handler.assert_called_once()
        assert mock_pull_request_handler.call_args[1]["extra"]["github_delivery_id"] == delivery_id

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_same_delivery_id_second_seen_skipped(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """
        Two deliveries with the same id, one after the other: the first marks seen and runs;
        the second is already seen (key exists), so only one handler run.
        """
        delivery_id = f"seen-sequential-{uuid4()}"
        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123
        event = {"action": "opened", "pull_request": {"number": 1, "draft": False}}
        repo = MagicMock()

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event=event,
            organization=self.organization,
            repo=repo,
            integration=integration,
        )
        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event=event,
            organization=self.organization,
            repo=repo,
            integration=integration,
        )

        assert mock_pull_request_handler.call_count == 1
        assert mock_pull_request_handler.call_args[1]["extra"]["github_delivery_id"] == delivery_id

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_same_delivery_id_after_ttl_expires_handler_invoked_twice(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """
        Same delivery_id twice: first run marks seen and runs; we delete the key (simulate TTL
        expiry); second run marks seen again and runs. Handler is invoked twice.
        """
        delivery_id = f"seen-after-ttl-{uuid4()}"
        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123
        event = {"action": "opened", "pull_request": {"number": 1, "draft": False}}
        repo = MagicMock()

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event=event,
            organization=self.organization,
            repo=repo,
            integration=integration,
        )
        assert mock_pull_request_handler.call_count == 1

        # Simulate TTL expiry: remove the seen key so the same delivery_id can be processed again
        cluster = redis_clusters.get("default")
        seen_key = f"{WEBHOOK_SEEN_KEY_PREFIX}{delivery_id}"
        cluster.delete(seen_key)

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event=event,
            organization=self.organization,
            repo=repo,
            integration=integration,
        )

        assert mock_pull_request_handler.call_count == 2
        assert mock_pull_request_handler.call_args[1]["extra"]["github_delivery_id"] == delivery_id

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_missing_delivery_id_handler_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """When github_delivery_id is None, the event is handled without a webhook seen check."""
        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 789

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            event={"action": "opened", "pull_request": {"number": 3, "draft": False}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        mock_pull_request_handler.assert_called_once()
