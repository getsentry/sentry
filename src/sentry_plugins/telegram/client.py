from sentry_plugins.client import ApiClient


class TelegramApiClient(ApiClient):
    plugin_name = "telegram"
    allow_redirects = False
    telegram_api_endpoint = "https://api.telegram.org/{0}/sendMessage"

    def __init__(self, api_key, group_id, topic_id, silent):
        self.api_key = api_key
        self.group_id = group_id
        self.topic_id = topic_id
        self.silent = silent
        super().__init__()

    def request(self, data):
        endpoint = self.telegram_api_endpoint.format(self.api_key)
        headers = {"Content-Type": "application/json"}
        return self._request(path=endpoint, method="post", data=data, headers=headers)