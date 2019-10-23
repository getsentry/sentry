from __future__ import absolute_import

from sentry.utils import json
from sentry.integrations.client import ApiClient
from sentry.models import EventCommon


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

        # Default is json=True, but for some reason the request fails when that is True so passing
        # along False instead
        return self._request(method, path, headers=headers, data=data, params=params, json=False)

    def send_trigger(self, data):
        # not sure if this will only been events for now
        if isinstance(data, EventCommon):
            source = data.transaction or data.culprit or "<unknown>"
            group = data.group
            payload = {
                "routing_key": self.integration_key,
                "event_action": "trigger",
                "dedup_key": group.qualified_short_id,
                "payload": {
                    # TODO(meredith): is this always set for events? does it need to be real_message
                    # should it be the group title instead ?
                    "summary": data.message or data.title,
                    "severity": "error",
                    "source": source,
                    "component": group.project.slug,
                    "custom_details": data.as_dict(),
                },
                "links": [{"href": group.get_absolute_url(), "text": "Issue Details"}],
            }
        return self.post("/", data=json.dumps(payload))

    def send_acknowledge(self, data):
        pass

    def send_resolve(self, data):
        pass
