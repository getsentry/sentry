from __future__ import annotations

import logging

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class VercelRequestParser(BaseRequestParser):
    provider = "vercel"
    webhook_identifier = WebhookProviderIdentifier.VERCEL

    def get_response(self):
        return self.get_response_from_control_silo()
