from sentry.shared_integrations.exceptions import ApiError
from sentry_plugins.client import ApiClient

IGNORABLE_SLACK_ERRORS = [
    "channel_is_archived",
    "invalid_channel",
    "invalid_token",
    "action_prohibited",
]


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
        try:
            return self._request(
                path=self.webhook, method="post", data=data, json=False, allow_text=True
            )
        except ApiError as e:
            # Ignore 404 and ignorable errors from slack webhooks
            if e.text and e.text in IGNORABLE_SLACK_ERRORS or e.code == 404:
                return
            raise e
