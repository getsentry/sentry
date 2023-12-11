from __future__ import annotations

from typing import Any

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.client.proxy import IntegrationProxyClient

LEVEL_SEVERITY_MAP = {
    "debug": "info",
    "info": "info",
    "warning": "warning",
    "error": "error",
    "fatal": "critical",
}


class PagerDutyProxyClient(IntegrationProxyClient):
    allow_redirects = False
    integration_name = "pagerduty"
    base_url = "https://events.pagerduty.com/v2/enqueue"

    def __init__(
        self,
        org_integration_id: int | None,
        integration_key: str,
        keyid: str | None = None,
    ) -> None:
        self.integration_key = integration_key
        super().__init__(org_integration_id=org_integration_id, keyid=keyid)

    def request(self, method: str, *args: Any, **kwargs: Any) -> BaseApiResponseX:
        headers = kwargs.pop("headers", None)
        if headers is None:
            headers = {"Content-Type": "application/json"}
        return self._request(method, *args, headers=headers, **kwargs)

    def send_trigger(self, data, notification_uuid: str | None = None):
        # expected payload: https://v2.developer.pagerduty.com/docs/send-an-event-events-api-v2
        if isinstance(data, (Event, GroupEvent)):
            source = data.transaction or data.culprit or "<unknown>"
            group = data.group
            level = data.get_tag("level") or "error"
            custom_details = serialize(data, None, ExternalEventSerializer())
            summary = custom_details["message"][:1024] or custom_details["title"]
            link_params = {"referrer": "pagerduty_integration"}
            if notification_uuid:
                link_params["notification_uuid"] = notification_uuid
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
                        "href": group.get_absolute_url(params=link_params),
                        "text": "View Sentry Issue Details",
                    }
                ],
            }
        else:
            # the payload is for a metric alert
            payload = data

        return self.post("/", data=payload)
