from __future__ import annotations

import logging
from typing import Any

from data_forwarding.base import DataForwardingPlugin
from sentry import VERSION, http
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event

logger = logging.getLogger(__name__)

DESCRIPTION = """
Send Sentry events to Segment.

This integration allows you to forward Sentry error events to Segment for unified analytics.

Segment is a customer data platform (CDP) that helps you collect, clean, and control your customer data.
"""


class SegmentDataForwarder(DataForwardingPlugin):
    provider = DataForwarderProviderSlug.SEGMENT
    name = "Segment"
    description = DESCRIPTION
    endpoint = "https://api.segment.io/v1/track"

    def get_rate_limit(self) -> tuple[int, int]:
        return (200, 1)

    def is_enabled_for_event(self, event: Event) -> bool:
        if event.get_event_type() != "error":
            return False

        user_interface = event.data.get("user")
        if not user_interface:
            return False

        user_id = user_interface.get("id")
        if not user_id:
            return False

        return True

    # https://segment.com/docs/spec/track/
    def get_event_payload(self, event: Event) -> dict[str, Any]:
        context = {"library": {"name": "sentry", "version": VERSION}}

        props = {
            "eventId": event.event_id,
            "transaction": event.get_tag("transaction") or "",
            "release": event.get_tag("sentry:release") or "",
            "level": event.get_tag("level") or "",
            "environment": event.get_tag("environment") or "",
        }

        if "user" in event.interfaces:
            user = event.interfaces["user"]
            if user.ip_address:
                context["ip"] = user.ip_address
            user_id = user.id
        else:
            user_id = None

        if "request" in event.interfaces:
            request = event.interfaces["request"]
            headers = request.headers
            if not isinstance(headers, dict):
                headers = dict(headers or ())

            context.update(
                {
                    "userAgent": headers.get("User-Agent", ""),
                    "page": {
                        "url": request.url,
                        "method": request.method,
                        "search": request.query_string or "",
                        "referrer": headers.get("Referer", ""),
                    },
                }
            )

        if "exception" in event.interfaces:
            exc = event.interfaces["exception"].values[0]
            props.update({"exceptionType": exc.type})

        return {
            "context": context,
            "userId": user_id,
            "event": "Error Captured",
            "properties": props,
            "integration": {"name": "sentry", "version": VERSION},
            "timestamp": event.datetime.isoformat() + "Z",
        }

    def forward_event(self, event: Event, data_forwarder_project: DataForwarderProject) -> bool:
        if not self.is_enabled_for_event(event):
            return False
        return super().forward_event(event, data_forwarder_project)

    def send_payload(
        self,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        write_key = config["write_key"]

        try:
            with http.build_session() as session:
                response = session.post(
                    self.endpoint,
                    json=payload,
                    auth=(write_key, ""),
                    timeout=10,
                )
                response.raise_for_status()
            return True

        except Exception:
            logger.exception(
                "segment.send_payload.error",
                extra={
                    "event_id": event.event_id,
                    "project_id": event.project_id,
                    "data_forwarder_id": data_forwarder_project.data_forwarder_id,
                },
            )
            return False
