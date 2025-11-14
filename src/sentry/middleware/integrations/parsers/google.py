from __future__ import annotations
from typing import int

import logging

from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser

logger = logging.getLogger(__name__)


class GoogleRequestParser(BaseRequestParser):
    provider = "google"
    webhook_identifier = WebhookProviderIdentifier.GOOGLE

    def get_response(self) -> HttpResponseBase:
        return self.get_response_from_control_silo()
