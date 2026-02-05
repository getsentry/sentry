from collections.abc import Generator
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.seer.code_review.webhooks.handlers import (
    DEDUPE_WEBHOOK_EVENT_LOCK_SECONDS,
    handle_webhook_event,
)
from sentry.testutils.cases import TestCase
from sentry.utils.locking import UnableToAcquireLock


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


class TestHandleWebhookEventLocks(TestCase):
    """Tests for handle_webhook_event lock and dedupe behavior (real lock backend where noted)."""

    @pytest.fixture(autouse=True)
    def mock_preflight_allowed(self) -> Generator[None]:
        """Patch CodeReviewPreflightService so check() returns allowed=True for all tests in this class."""
        with patch(
            "sentry.seer.code_review.webhooks.handlers.CodeReviewPreflightService"
        ) as mock_preflight:
            mock_preflight.return_value.check.return_value.allowed = True
            mock_preflight.return_value.check.return_value.denial_reason = None
            mock_preflight.return_value.check.return_value.settings = None
            yield

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_lock_held_handler_not_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """
        When the lock is already held (e.g. concurrent delivery),
        handle_webhook_event returns without invoking the handler (dedupe).
        """
        delivery_id = f"real-lock-dedupe-{uuid4()}"
        lock_key = f"github:code_review:webhook:{delivery_id}"
        lock = locks.get(
            lock_key,
            duration=DEDUPE_WEBHOOK_EVENT_LOCK_SECONDS,
            name="github_code_review_webhook_id",
        )

        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123

        with lock.acquire():
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
    def test_lock_available_handler_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """When the lock is available, handle_webhook_event acquires it and invokes the handler."""
        delivery_id = f"real-lock-success-{uuid4()}"

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
    @patch("sentry.seer.code_review.webhooks.handlers.locks.get")
    def test_lock_acquire_failure_handler_not_invoked(
        self,
        mock_locks_get: MagicMock,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """If lock acquisition raises UnableToAcquireLock, the handler is not invoked."""
        delivery_id = f"fail-to-acquire-{uuid4()}"

        integration = MagicMock()
        integration.provider = IntegrationProviderSlug.GITHUB
        integration.id = 123

        mock_lock = MagicMock()
        mock_lock.acquire.side_effect = UnableToAcquireLock()
        mock_locks_get.return_value = mock_lock

        handle_webhook_event(
            github_event=GithubWebhookType.PULL_REQUEST,
            github_delivery_id=delivery_id,
            event={"action": "opened", "pull_request": {"number": 2, "draft": False}},
            organization=self.organization,
            repo=MagicMock(),
            integration=integration,
        )

        mock_pull_request_handler.assert_not_called()

    @patch("sentry.seer.code_review.webhooks.handlers.handle_pull_request_event")
    def test_missing_delivery_id_handler_invoked(
        self,
        mock_pull_request_handler: MagicMock,
    ) -> None:
        """When github_delivery_id is None, the event is handled without acquiring a lock."""
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
