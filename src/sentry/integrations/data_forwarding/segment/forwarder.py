from __future__ import annotations

import logging
from typing import Any, ClassVar

from sentry import VERSION, http
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event, GroupEvent

logger = logging.getLogger(__name__)


class SegmentForwarder(BaseDataForwarder):
    provider = DataForwarderProviderSlug.SEGMENT
    rate_limit = (200, 1)
    endpoint: ClassVar[str] = "https://api.segment.io/v1/track"

    def get_event_payload(
        self, event: Event | GroupEvent, config: dict[str, Any]
    ) -> dict[str, Any]:
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

    def forward_event(
        self,
        event: Event | GroupEvent,
        payload: dict[str, Any],
        config: dict[str, Any],
    ) -> bool:
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

        write_key = config["write_key"]
        if not write_key:
            return False

        try:
            with http.build_session() as session:
                response = session.post(
                    self.endpoint,
                    json=payload,
                    auth=(write_key, ""),
                    timeout=10,
                )
                response.raise_for_status()
        except Exception:
            logger.exception(
                "segment.send_payload.error",
                extra={"event_id": event.event_id, "project_id": event.project_id},
            )
            return False
        return True
