from sentry.utils.http import absolute_uri
from sentry_plugins.client import ApiClient

# https://v2.developer.pagerduty.com/docs/events-api
INTEGRATION_API_URL = "https://events.pagerduty.com/generic/2010-04-15/create_event.json"


class PagerDutyClient(ApiClient):
    client = "sentry"
    plugin_name = "pagerduty"
    allow_redirects = False

    def __init__(self, service_key=None):
        self.service_key = service_key
        super().__init__()

    def build_url(self, path):
        return INTEGRATION_API_URL

    def request(self, data):
        payload = {"service_key": self.service_key}
        payload.update(data)

        return self._request(path="", method="post", data=payload)

    def trigger_incident(
        self,
        description,
        event_type,
        details,
        incident_key,
        client=None,
        client_url=None,
        contexts=None,
    ):
        return self.request(
            {
                "event_type": event_type,
                "description": description,
                "details": details,
                "incident_key": incident_key,
                "client": client or self.client,
                "client_url": client_url or absolute_uri(),
                "contexts": contexts,
            }
        )
