from __future__ import absolute_import

from sentry import http
from sentry.utils import json
from sentry.integrations.client import ApiClient
from sentry.models import EventCommon


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = 'pagerduty'

    def __init__(self, integration_key):
        self.integration_key = integration_key
        super(PagerDutyClient, self).__init__()

    def request(self, payload):
        session = http.build_session()
        resp = session.post(
            "https://events.pagerduty.com/v2/enqueue",
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=5,
        )
        resp.raise_for_status()
        resp = resp.json()

    def send_trigger(self, data):
        # not sure if this will only been events for now
        if isinstance(data, EventCommon):
            source = data.transaction or data.culprit or '<unknown>'
            group = data.group
            payload = {
                "routing_key": self.integration_key,
                "event_action": "trigger",
                "dedup_key": group.qualified_short_id,
                "payload": {
                    # TODO(meredith): is this always set for events? does it need to be real_message
                    # should it be the group title instead ?
                    "summary": data.message,
                    "severity": "error",
                    "source": source,
                    "component": group.project.slug,
                    "custom_details": data.as_dict(),
                },
                "links": [{"href": group.get_absolute_url(), "text": "Issue Details"}]
            }
        self.request(payload)

    def send_acknowledge(self, data):
        payload = {
            "routing_key": self.integration_key,
            "dedup_key": data.qualified_short_id,
            "event_action": "acknowledge",
            "payload": {
                "summary": data.title,
                "severity": "error",
                "source": "",
            }
        }
        self.request(payload)

    def send_resolve(self, data):
        pass
