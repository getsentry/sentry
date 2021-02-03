from sentry_plugins.client import ApiClient


class SplunkApiClient(ApiClient):
    plugin_name = "splunk"
    allow_redirects = False
    datadog_prefix = "integrations.splunk"

    def __init__(self, endpoint, token):
        self.endpoint = endpoint
        self.token = token
        super(SplunkApiClient, self).__init__(verify_ssl=False)

    def request(self, data):
        headers = {"Authorization": "Splunk {}".format(self.token)}
        return self._request(
            path=self.endpoint, method="post", data=data, headers=headers, json=True, timeout=5
        )
