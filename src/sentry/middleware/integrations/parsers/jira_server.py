from __future__ import annotations

import logging

from sentry.integrations.jira_server.webhooks import (
    JiraServerIssueUpdatedWebhook,
    get_integration_from_token,
)
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

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
            return self.get_response_from_control_silo()
        organizations = self.get_organizations_from_integration(integration=integration)
        regions = self.get_regions_from_organizations(organizations=organizations)
        return self.get_response_from_outbox_creation(regions=regions)

    def get_response(self):
        if self.view_class == JiraServerIssueUpdatedWebhook:
            return self.get_response_from_issue_update_webhook()
        return self.get_response_from_control_silo()
