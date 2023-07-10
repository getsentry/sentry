from __future__ import annotations

import logging

from sentry.integrations.jira.webhooks import JiraIssueUpdatedWebhook
from sentry.integrations.jira_server.search import JiraServerSearchEndpoint
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class JiraServerRequestParser(BaseRequestParser):
    provider = "jira_server"
    webhook_identifier = WebhookProviderIdentifier.JIRA_SERVER

    immediate_response_region_classes = [JiraServerSearchEndpoint]
    outbox_response_region_classes = [JiraIssueUpdatedWebhook]
