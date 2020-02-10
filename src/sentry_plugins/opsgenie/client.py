from __future__ import absolute_import

from sentry_plugins.client import ApiClient


class OpsGenieApiClient(ApiClient):
    monitoring_tool = "sentry"
    plugin_name = "opsgenie"
    allow_redirects = False

    def __init__(self, api_key, alert_url, recipients=None):
        self.api_key = api_key
        self.alert_url = alert_url
        self.recipients = recipients
        super(OpsGenieApiClient, self).__init__()

    def build_url(self, _path):
        return self.alert_url

    def request(self, data):
        headers = {"Authorization": "GenieKey " + self.api_key}
        return self._request(path="", method="post", data=data, headers=headers)

    def trigger_incident(self, payload):
        if self.recipients:
            payload = payload.copy()
            payload["recipients"] = self.recipients
        return self.request(payload)
