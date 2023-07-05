from __future__ import annotations

import logging

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function

logger = logging.getLogger(__name__)


class BitbucketRequestParser(BaseRequestParser):
    provider = "bitbucket"
    webhook_identifier = WebhookProviderIdentifier.BITBUCKET

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        pass

    def get_response(self):
        return self.get_response_from_control_silo()
