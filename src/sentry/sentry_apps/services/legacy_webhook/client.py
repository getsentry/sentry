from requests import Response

from sentry.sentry_apps.services.legacy_webhook.service import LegacyWebhookPayload
from sentry.shared_integrations.client.base import BaseApiClient


class LegacyWebhookClient(BaseApiClient):
    integration_type = "legacy_webhook"
    legacy_webhook_name = "legacy_webhook"
    allow_redirects = False
    metrics_prefix = "integrations.legacy_webhook"

    def __init__(self, data: LegacyWebhookPayload) -> None:
        self.data = data
        super().__init__(verify_ssl=False)

    def request(self, url: str) -> Response:
        return self._request(
            path=url,
            method="post",
            data=self.data,
            json=True,
            timeout=5,
            allow_text=True,
            ignore_webhook_errors=True,
        )
