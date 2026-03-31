from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.http import HttpRequest

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.github.webhook import get_github_external_id
from sentry.integrations.github.webhook_types import GITHUB_WEBHOOK_TYPE_HEADER, GithubWebhookType
from sentry.integrations.github_enterprise.webhook import GitHubEnterpriseWebhookEndpoint, get_host
from sentry.integrations.types import IntegrationProviderSlug
from sentry.middleware.integrations.parsers.github import GithubRequestParser

logger = logging.getLogger(__name__)


class GithubEnterpriseRequestParser(GithubRequestParser):
    provider = IntegrationProviderSlug.GITHUB_ENTERPRISE.value
    webhook_identifier = WebhookProviderIdentifier.GITHUB_ENTERPRISE
    webhook_endpoint = GitHubEnterpriseWebhookEndpoint

    def should_route_to_control_silo(
        self, parsed_event: Mapping[str, Any], request: HttpRequest
    ) -> bool:
        # GHE only routes installation events to control silo.
        # installation_repositories is not yet supported for GHE.
        return request.META.get(GITHUB_WEBHOOK_TYPE_HEADER) == GithubWebhookType.INSTALLATION

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        host = get_host(request=self.request)
        if not host:
            return None
        return get_github_external_id(event=event, host=host)
