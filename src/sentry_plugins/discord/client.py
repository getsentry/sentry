from typing import Any, Mapping

from sentry_plugins.client import ApiClient


class DiscordWebhookClient(ApiClient):
    plugin_name = "discord"
    allow_redirects = False

    def __init__(self, webhook: str) -> None:
        self.webhook = webhook
        super().__init__()

    def request(self, data: Mapping[str, Any]):
        return self._request(
            path=self.webhook,
            method="post",
            data=data,
            json=True,
        )
