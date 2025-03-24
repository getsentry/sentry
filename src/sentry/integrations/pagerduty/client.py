from __future__ import annotations

from typing import Any, Literal

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.client import ApiClient
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.pagerduty.metrics import record_event

# https://v2.developer.pagerduty.com/docs/send-an-event-events-api-v2
type PagerDutyEventPayload = dict[str, Any]
type PagerdutySeverity = Literal["default", "critical", "warning", "error", "info"]
LEVEL_SEVERITY_MAP: dict[str, PagerdutySeverity] = {
    "debug": "info",
    "info": "info",
    "warning": "warning",
    "error": "error",
    "fatal": "critical",
}
PAGERDUTY_DEFAULT_SEVERITY: PagerdutySeverity = "default"  # represents using LEVEL_SEVERITY_MAP


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = "pagerduty"
    base_url = "https://events.pagerduty.com/v2/enqueue"

    def __init__(self, integration_key: str, integration_id: int | None) -> None:
        self.integration_key = integration_key
        super().__init__(integration_id=integration_id)

    def request(self, method: str, *args: Any, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", None)
        if headers is None:
            headers = {"Content-Type": "application/json"}
        return self._request(method, *args, headers=headers, **kwargs)

    def send_trigger(self, data: PagerDutyEventPayload):
        with record_event(OnCallInteractionType.CREATE).capture():
            return self.post("/", data=data)


def build_pagerduty_event_payload(
    *,
    routing_key: str,
    event: Event | GroupEvent,
    notification_uuid: str | None,
    severity: PagerdutySeverity | None = None,
) -> PagerDutyEventPayload:
    source = event.transaction or event.culprit or "<unknown>"
    group = event.group
    level = event.get_tag("level") or "error"
    custom_details = serialize(event, None, ExternalEventSerializer())
    summary = custom_details["message"][:1024] or custom_details["title"]

    link_params = {"referrer": "pagerduty_integration"}
    if notification_uuid:
        link_params["notification_uuid"] = notification_uuid

    if severity == PAGERDUTY_DEFAULT_SEVERITY:
        severity = LEVEL_SEVERITY_MAP[level]

    payload: PagerDutyEventPayload = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": summary,
            "severity": severity,
            "source": source,
            "custom_details": custom_details,
        },
        "client": "sentry",
    }

    if group:
        client_url = group.get_absolute_url(params=link_params)
        payload["client_url"] = client_url
        payload["dedup_key"] = group.qualified_short_id
        payload["payload"]["component"] = group.project.slug
        payload["links"] = [
            {
                "href": client_url,
                "text": "View Sentry Issue Details",
            }
        ]

    return payload
