from __future__ import annotations

import logging
from typing import Any, ClassVar, int

from sentry import VERSION, http
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event

logger = logging.getLogger(__name__)

DESCRIPTION = """
Send Sentry events to Segment.

This integration allows you to forward Sentry error events to Segment for unified analytics.

Segment is a customer data platform (CDP) that helps you collect, clean, and control your customer data.
"""


class SegmentForwarder(BaseDataForwarder):
    provider = DataForwarderProviderSlug.SEGMENT
    rate_limit = (200, 1)
    description = DESCRIPTION
    endpoint: ClassVar[str] = "https://api.segment.io/v1/track"

    @classmethod
    def validate_event(cls, event: Event) -> bool:
        # we currently only support errors
        if event.get_event_type() != "error":
            return False

        # we avoid instantiating interfaces here as they're only going to be
        # used if there's a User present
        user_interface = event.interfaces.get("user")
        if not user_interface:
            return False

        # if the user id is not present, we can't forward the event
        if not user_interface.id:
            return False

        return True

    @classmethod
    def get_event_payload(cls, event: Event) -> dict[str, Any]:
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

    @classmethod
    def send_payload(
        cls,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        write_key = config["write_key"]

        try:
            with http.build_session() as session:
                response = session.post(
                    cls.endpoint,
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

    @classmethod
    def forward_event(cls, event: Event, data_forwarder_project: DataForwarderProject) -> bool:
        if not cls.validate_event(event):
            return False

        config = data_forwarder_project.get_config()
        payload = cls.get_event_payload(event)
        return cls.send_payload(payload, config, event, data_forwarder_project)
