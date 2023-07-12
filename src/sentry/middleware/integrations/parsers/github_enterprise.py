from __future__ import annotations

import logging

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class GithubEnterpriseRequestParser(BaseRequestParser):
    provider = "github_enterprise"
    webhook_identifier = WebhookProviderIdentifier.GITHUB_ENTERPRISE
