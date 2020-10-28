from __future__ import absolute_import

from sentry.integrations.client import ApiClient
from sentry.eventstore.models import Event
from sentry.api.serializers import serialize, ExternalEventSerializer

LEVEL_SEVERITY_MAP = {
    "debug": "info",
    "info": "info",
    "warning": "warning",
    "error": "error",
    "fatal": "critical",
}


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = "pagerduty"
    base_url = "https://events.pagerduty.com/v2/enqueue"

    def __init__(self, integration_key):
        self.integration_key = integration_key
        super(PagerDutyClient, self).__init__()

    def request(self, method, path, headers=None, data=None, params=None):
        if not headers:
            headers = {"Content-Type": "application/json"}

        return self._request(method, path, headers=headers, data=data, params=params)

    def send_trigger(self, data):
        # expected payload: https://v2.developer.pagerduty.com/docs/send-an-event-events-api-v2
        if isinstance(data, Event):
            source = data.transaction or data.culprit or "<unknown>"
            group = data.group
            level = data.get_tag("level") or "error"
            custom_details = serialize(data, None, ExternalEventSerializer())
            summary = (data.message or data.title)[:1024]
            payload = {
                "routing_key": self.integration_key,
                "event_action": "trigger",
                "dedup_key": group.qualified_short_id,
                "payload": {
                    "summary": summary,
                    "severity": LEVEL_SEVERITY_MAP[level],
                    "source": source,
                    "component": group.project.slug,
                    "custom_details": custom_details,
                },
                "links": [
                    {
                        "href": group.get_absolute_url(
                            params={"referrer": "pagerduty_integration"}
                        ),
                        "text": "Issue Details",
                    }
                ],
            }
        else:
            # the payload is for a metric alert
            payload = data

        return self.post("/", data=payload)

    def send_acknowledge(self, data):
        pass

    def send_resolve(self, data):
        pass
