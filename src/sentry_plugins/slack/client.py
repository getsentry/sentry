from sentry_plugins.client import ApiClient


class SlackApiClient(ApiClient):
    plugin_name = "slack"
    allow_redirects = False

    def __init__(self, webhook, username, icon_url, channel):
        self.webhook = webhook
        self.username = username
        self.icon_url = icon_url
        self.channel = channel
        super().__init__()

    def request(self, data):
        return self._request(
            path=self.webhook, method="post", data=data, json=False, allow_text=True
        )
