from __future__ import annotations

from typing import Any, Literal

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.client import ApiClient
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.pagerduty.metrics import record_event

LEVEL_SEVERITY_MAP = {
    "debug": "info",
    "info": "info",
    "warning": "warning",
    "error": "error",
    "fatal": "critical",
}
PAGERDUTY_DEFAULT_SEVERITY = "default"  # represents using LEVEL_SEVERITY_MAP
PagerdutySeverity = Literal["default", "critical", "warning", "error", "info"]


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = "pagerduty"
    base_url = "https://events.pagerduty.com/v2/enqueue"

    def __init__(self, integration_key: str, integration_id: int | None) -> None:
        # Clean the integration key by stripping whitespace and quotes
        self.integration_key = integration_key.strip().strip("'").strip('"')
        super().__init__(integration_id=integration_id)

    def request(self, method: str, *args: Any, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", None)
        if headers is None:
            headers = {"Content-Type": "application/json"}
        return self._request(method, *args, headers=headers, **kwargs)

    def send_trigger(
        self,
        data,
        notification_uuid: str | None = None,
        severity: PagerdutySeverity | None = None,
    ):
        # Ensure routing_key is clean when sending to PagerDuty API
        if isinstance(data, dict) and "routing_key" in data:
            data["routing_key"] = data["routing_key"].strip().strip("'").strip('"')

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

            if severity == PAGERDUTY_DEFAULT_SEVERITY:
                severity = LEVEL_SEVERITY_MAP[level]

            client_url = group.get_absolute_url(params=link_params)

            payload = {
                "routing_key": self.integration_key,
                "event_action": "trigger",
                "dedup_key": group.qualified_short_id,
                "payload": {
                    "summary": summary,
                    "severity": severity,
                    "source": source,
                    "component": group.project.slug,
                    "custom_details": custom_details,
                },
                "client": "sentry",
                "client_url": client_url,
                "links": [
                    {
                        "href": client_url,
                        "text": "View Sentry Issue Details",
                    }
                ],
            }
        else:
            # the payload is for a metric alert
            payload = data
        with record_event(OnCallInteractionType.CREATE).capture():
            return self.post("/", data=payload)
