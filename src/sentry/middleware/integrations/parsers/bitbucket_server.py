from __future__ import annotations

import logging

from django.http import HttpResponse

from sentry.integrations.bitbucket_server.webhook import BitbucketServerWebhookEndpoint
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier

logger = logging.getLogger(__name__)


class BitbucketServerRequestParser(BaseRequestParser):
    provider = "bitbucket_server"
    webhook_identifier = WebhookProviderIdentifier.BITBUCKET_SERVER

    def get_bitbucket_server_webhook_response(self):
        pass

    def get_response(self) -> HttpResponse:
        view_class = self.match.func.view_class  # type: ignore
        if view_class == BitbucketServerWebhookEndpoint:
            return self.get_bitbucket_server_webhook_response()
        return self.get_response_from_control_silo()
