from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.http import HttpResponse

from sentry import options
from sentry.integrations.jira_server.webhooks import (
    JiraServerIssueUpdatedWebhook,
    get_integration_from_token,
)
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.ratelimits import backend as ratelimiter
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.utils import json

logger = logging.getLogger(__name__)


class JiraServerRequestParser(BaseRequestParser):
    provider = "jira_server"
    webhook_identifier = WebhookProviderIdentifier.JIRA_SERVER

    def get_response_from_issue_update_webhook(self):
        token = self.match.kwargs.get("token")
        try:
            integration = get_integration_from_token(token)
        except ValueError as e:
            logger.info("%s.no_integration", self.provider, extra={"error": str(e)})
            return HttpResponse(status=200)

        organizations = self.get_organizations_from_integration(integration=integration)
        regions = self.get_regions_from_organizations(organizations=organizations)

        try:
            data = json.loads(self.request.body)
        except ValueError:
            data = {}

        # We only process webhooks with changelogs
        if not data.get("changelog"):
            logger.info("missing-changelog", extra={"integration_id": integration.id})
            return HttpResponse(status=200)

        identifier = self.get_mailbox_identifier(integration, data)
        return self.get_response_from_webhookpayload(
            regions=regions,
            identifier=identifier,
            integration_id=integration.id,
        )

    def get_mailbox_identifier(self, integration: RpcIntegration, data: Mapping[str, Any]) -> str:
        """
        Some Jira server instances send us high volumes of hooks.
        Splitting these hooks across multiple mailboxes allows us to deliver messages in parallel
        without sacrificing linearization that customers care about.
        """
        enabled = options.get("hybridcloud.webhookpayload.use_mailbox_buckets")
        issue_id = data.get("issue", {}).get("id", None)
        if not issue_id or not enabled:
            return str(integration.id)

        # If we get fewer than 3000 in 1 hour we don't need to split into buckets
        ratelimit_key = f"webhookpayload:{self.provider}:{integration.id}"
        if not ratelimiter.is_limited(key=ratelimit_key, window=60 * 60, limit=3000):
            return str(integration.id)

        # Split high volume integrations into 100 buckets.
        # 100 is arbitrary but we can't leave it unbounded.
        bucket_number = issue_id % 100

        return f"{integration.id}:{bucket_number}"

    def get_response(self):
        if self.view_class == JiraServerIssueUpdatedWebhook:
            return self.get_response_from_issue_update_webhook()

        return self.get_response_from_control_silo()
