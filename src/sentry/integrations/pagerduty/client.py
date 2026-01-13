from __future__ import annotations

from enum import StrEnum
from typing import Any

from requests import Response

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.integrations.client import ApiClient
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.pagerduty.metrics import record_event
from sentry.integrations.types import IntegrationProviderSlug
from sentry.services.eventstore.models import Event, GroupEvent

type PagerDutyEventPayload = dict[str, Any]


# https://v2.developer.pagerduty.com/docs/send-an-event-events-api-v2
class PagerdutySeverity(StrEnum):
    DEFAULT = "default"
    CRITICAL = "critical"
    WARNING = "warning"
    ERROR = "error"
    INFO = "info"


LEVEL_SEVERITY_MAP: dict[str, PagerdutySeverity] = {
    "debug": PagerdutySeverity.INFO,
    "info": PagerdutySeverity.INFO,
    "warning": PagerdutySeverity.WARNING,
    "error": PagerdutySeverity.ERROR,
    "fatal": PagerdutySeverity.CRITICAL,
}
PAGERDUTY_DEFAULT_SEVERITY = PagerdutySeverity.DEFAULT  # represents using LEVEL_SEVERITY_MAP
PAGERDUTY_SUMMARY_MAX_LENGTH = 1024


class PagerDutyClient(ApiClient):
    allow_redirects = False
    integration_name = IntegrationProviderSlug.PAGERDUTY.value
    base_url = "https://events.pagerduty.com/v2/enqueue"
    # Set a shorter timeout for PagerDuty API calls to avoid exhausting the task deadline
    timeout = 15

    def __init__(self, integration_key: str, integration_id: int | None) -> None:
        self.integration_key = integration_key
        super().__init__(integration_id=integration_id)

    def request(self, *args: Any, **kwargs: Any) -> Any:
        kwargs.setdefault("headers", {"Content-Type": "application/json"})
        return self._request(*args, **kwargs)

    def send_trigger(self, data: PagerDutyEventPayload) -> Response:
        with record_event(OnCallInteractionType.CREATE).capture():
            return self.post("/", data=data)


def build_pagerduty_event_payload(
    *,
    routing_key: str,
    event: Event | GroupEvent,
    notification_uuid: str | None,
    severity: PagerdutySeverity,
) -> PagerDutyEventPayload:
    source = event.transaction or event.culprit or "<unknown>"
    group = event.group
    level = event.get_tag("level") or "error"
    custom_details = serialize(event, None, ExternalEventSerializer())
    summary = custom_details["message"][:PAGERDUTY_SUMMARY_MAX_LENGTH] or custom_details["title"]

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
