from typing import int
import hashlib
import hmac
import logging

import requests
from django.conf import settings
from google.cloud.pubsub import PublisherClient

from sentry.overwatch_webhooks.types import WebhookDetails
from sentry.types.region import Region

logger = logging.getLogger("sentry.overwatch_webhooks")


class OverwatchWebhookPublisher:
    _publisher_client: PublisherClient
    _region: Region
    _integration_provider: str

    def __init__(self, integration_provider: str, region: Region):
        self._integration_provider = integration_provider
        self._region = region

    def enqueue_webhook(self, webhook_details: WebhookDetails):
        base_addr = self._get_request_address()

        body = webhook_details.to_json()
        requests.post(
            f"{base_addr}/webhooks/sentry",
            data=webhook_details.to_json(),
            headers={
                "content-type": "application/json;charset=utf-8",
                "x-sentry-overwatch-signature": self._get_request_signature(body),
            },
        )

    def _get_request_signature(self, body: str) -> str:

        if not (webhook_secret := settings.OVERWATCH_WEBHOOK_SECRET):
            raise ValueError("OVERWATCH_WEBHOOK_SECRET is not set")

        return hmac.new(
            key=webhook_secret.encode("utf-8"),
            msg=body.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

    def _get_request_address(self) -> str:
        addr = settings.OVERWATCH_REGION_URLS.get(self._region.name)
        if not addr:
            raise ValueError(f"Missing overwatch request address for region {self._region.name}")
        return addr
