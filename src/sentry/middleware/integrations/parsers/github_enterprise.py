from __future__ import annotations

import logging
from typing import Any, Mapping

from sentry.integrations.github.webhook import get_github_external_id
from sentry.integrations.github_enterprise.webhook import GitHubEnterpriseWebhookEndpoint, get_host
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class GithubEnterpriseRequestParser(GithubRequestParser):
    provider = "github_enterprise"
    webhook_identifier = WebhookProviderIdentifier.GITHUB_ENTERPRISE
    webhook_endpoint = GitHubEnterpriseWebhookEndpoint

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        host = get_host(request=self.request)
        if not host:
            return None
        return get_github_external_id(event=event, host=host)
