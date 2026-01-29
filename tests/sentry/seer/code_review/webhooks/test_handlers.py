from unittest.mock import MagicMock, patch

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.types import IntegrationProviderSlug
from sentry.seer.code_review.webhooks.handlers import handle_webhook_event
from sentry.testutils.cases import TestCase


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
