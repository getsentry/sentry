from __future__ import annotations

from typing import Any

from sentry.analytics.event import EventEnvelope
from sentry.analytics.mcp_attribution import get_mcp_attribution

__all__ = ("PubSubAnalytics",)

import logging

import google.cloud.pubsub_v1 as pubsub_v1  # weird import for python/mypy#10360
from google.auth.exceptions import GoogleAuthError

from sentry.utils.json import dumps

from . import Analytics

logger = logging.getLogger(__name__)


class PubSubAnalytics(Analytics):
    def __init__(
        self,
        project: str,
        topic: str,
        batch_max_bytes: int = 1024 * 1024 * 5,
        batch_max_latency: float = 0.05,
        batch_max_messages: int = 1000,
    ) -> None:
        settings = pubsub_v1.types.BatchSettings(
            max_bytes=batch_max_bytes,
            max_latency=batch_max_latency,
            max_messages=batch_max_messages,
        )
        try:
            self.publisher = pubsub_v1.PublisherClient(settings)
        except GoogleAuthError:
            logger.warning("Unable to initialize PubSubAnalytics, no auth found")
            self.publisher = None
        else:
            self.topic = self.publisher.topic_path(project, topic)

    def record_event_envelope(self, event: EventEnvelope) -> None:
        if self.publisher is None:
            return

        payload = event.serialize()
        data: dict[str, Any] = payload["data"]
        attribution = get_mcp_attribution()
        if attribution.mcp:
            data.setdefault("mcp", True)
        if attribution.client is not None:
            data.setdefault("mcp_client", attribution.client)
        if attribution.utm_source is not None:
            data.setdefault("mcp_utm_source", attribution.utm_source)

        self.publisher.publish(self.topic, data=dumps(payload).encode("utf-8"))
