from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http import HttpResponse

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.jira_server.webhooks import (
    JiraServerIssueUpdatedWebhook,
    get_integration_from_token,
)
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser

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
            data = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            data = {}

        # We only process webhooks with changelogs
        if not data.get("changelog"):
            logger.info("missing-changelog", extra={"integration_id": integration.id})
            return HttpResponse(status=200)

        return self.get_response_from_webhookpayload(
            regions=regions,
            identifier=self.get_mailbox_identifier(integration, data),
            integration_id=integration.id,
        )

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """
        Used by get_mailbox_identifier to find the issue.id a payload is for.
        In high volume jira_server instances we shard messages by issue for greater
        delivery throughput.
        """
        issue_id = data.get("issue", {}).get("id", None)
        if not issue_id:
            return None
        try:
            return int(issue_id)
        except ValueError:
            return None

    def get_response(self):
        if self.view_class == JiraServerIssueUpdatedWebhook:
            return self.get_response_from_issue_update_webhook()

        return self.get_response_from_control_silo()
