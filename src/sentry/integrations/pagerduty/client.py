from __future__ import absolute_import

from sentry.utils import json
from sentry.integrations.client import ApiClient
from sentry.models import EventCommon
from sentry.api.serializers import serialize, ExternalEventSerializer


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

        # (XXX) Meredith: We stringify the data ahead of time in send_trigger (because reasons)
        # so we have to pass json=False since True is the default.
        return self._request(method, path, headers=headers, data=data, params=params, json=False)

    def send_trigger(self, data):
        # not sure if this will only been events for now
        if isinstance(data, EventCommon):
            source = data.transaction or data.culprit or "<unknown>"
            group = data.group
            custom_details = serialize(data, None, ExternalEventSerializer())
            payload = {
                "routing_key": self.integration_key,
                "event_action": "trigger",
                "dedup_key": group.qualified_short_id,
                "payload": {
                    "summary": data.message or data.title,
                    "severity": data.get_tag("level") or "error",
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
        # (XXX) Meredith: The 'datetime' property that is included in as_dict doesn't
        # get properly serializied in the requests library so we stringify it here instead.
        return self.post("/", data=json.dumps(payload))

    def send_acknowledge(self, data):
        pass

    def send_resolve(self, data):
        pass
