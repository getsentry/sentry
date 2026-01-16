"""
Utilities for testing GitHub integration webhooks.
"""

from __future__ import annotations

from collections.abc import Collection, Generator, Mapping
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import orjson
from django.http.response import HttpResponseBase

from sentry import options
from sentry.integrations.github.webhook import GitHubIntegrationsWebhookEndpoint
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.models.integration import Integration
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


def compute_github_webhook_signature(body: bytes, secret: str, method: str = "sha256") -> str:
    """
    Compute GitHub webhook signature for testing.

    This uses the same HMAC logic as GitHub's webhook signature validation.

    Args:
        body: The request body as bytes
        secret: The webhook secret
        method: Hash method ('sha1' or 'sha256')

    Returns:
        Signature string in format "method=hexdigest"
    """
    signature = GitHubIntegrationsWebhookEndpoint.compute_signature(method, body, secret)
    return f"{method}={signature}"


class GitHubWebhookTestCase(APITestCase):
    """
    Base test case for GitHub webhook tests.

    Provides common utilities for:
    - Setting up GitHub integrations
    - Computing webhook signatures
    - Sending webhook events with proper authentication
    """

    def setUp(self) -> None:
        super().setUp()
        self.github_webhook_url = "/extensions/github/webhook/"
        self.github_webhook_secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.github_webhook_secret)

    def create_github_integration(
        self,
        external_id: str = "12345",
        access_token: str = "1234",
        **metadata_overrides: Any,
    ) -> Integration:
        """
        Create a GitHub integration for testing.

        Args:
            external_id: GitHub installation ID
            access_token: GitHub access token
            **metadata_overrides: Additional metadata fields

        Returns:
            The created integration
        """
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        metadata = {
            "access_token": access_token,
            "expires_at": future_expires.isoformat(),
            **metadata_overrides,
        }

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id=external_id,
                provider="github",
                metadata=metadata,
            )
            integration.add_organization(self.project.organization.id, self.user)

        return integration

    def send_github_webhook_event(
        self,
        github_event: GithubWebhookType,
        event_data: str | bytes,
        **extra_headers: str,
    ) -> HttpResponseBase:
        """
        Send a GitHub webhook event with proper signatures and headers.

        Args:
            github_event: GitHub event type (e.g., "push", "pull_request", "check_run")
            event_data: The webhook event payload (as JSON string or bytes)
            **extra_headers: Additional HTTP headers

        Returns:
            Response from the webhook endpoint
        """
        # Convert to bytes if needed
        event_bytes = event_data.encode("utf-8") if isinstance(event_data, str) else event_data

        # Compute signatures
        sha1_sig = compute_github_webhook_signature(event_bytes, self.github_webhook_secret, "sha1")
        sha256_sig = compute_github_webhook_signature(
            event_bytes, self.github_webhook_secret, "sha256"
        )

        # Build headers
        headers = {
            "HTTP_X_GITHUB_EVENT": github_event.value,
            "HTTP_X_HUB_SIGNATURE": sha1_sig,
            "HTTP_X_HUB_SIGNATURE_256": sha256_sig,
            "HTTP_X_GITHUB_DELIVERY": str(uuid4()),
            **extra_headers,
        }

        # The DRF APIClient stubs can misinterpret **extra headers as a positional arg
        client: Any = self.client
        return client.post(
            self.github_webhook_url,
            data=event_data,
            content_type="application/json",
            **headers,
        )


class GitHubWebhookCodeReviewTestCase(GitHubWebhookTestCase):
    CODE_REVIEW_FEATURES = {"organizations:gen-ai-features", "organizations:code-review-beta"}
    OPTIONS_TO_SET: dict[str, Any] = {}

    @contextmanager
    def code_review_setup(
        self,
        features: Collection[str] | Mapping[str, Any] | None = None,
        options: dict[str, Any] | None = None,
        triggers: list[CodeReviewTrigger] | None = None,
    ) -> Generator[None]:
        """Helper to set up code review test context."""
        self._triggers = [] if triggers is None else triggers
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)
        features_to_enable = self.CODE_REVIEW_FEATURES if features is None else features
        options_to_set = dict(self.OPTIONS_TO_SET) | (options or {})
        with (
            self.feature(features_to_enable),
            self.options(options_to_set),
        ):
            yield

    def _send_webhook_event(
        self, github_event: GithubWebhookType, event_data: bytes | str
    ) -> HttpResponseBase:
        """Helper to send a GitHub webhook event."""
        self.event_dict = (
            orjson.loads(event_data) if isinstance(event_data, (bytes, str)) else event_data
        )
        repo_id = str(self.event_dict["repository"]["id"])
        integration = self.create_github_integration()
        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=repo_id,
            integration_id=integration.id,
        )

        if self._triggers:
            trigger_values = [t.value for t in self._triggers]
            self.create_repository_settings(
                repository=repo,
                enabled_code_review=True,
                code_review_triggers=trigger_values,
            )

        response = self.send_github_webhook_event(github_event, event_data)
        assert response.status_code == 204
        return response
