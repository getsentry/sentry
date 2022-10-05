from __future__ import annotations

__all__ = ("PubSubAnalytics",)

import logging

from google.auth.exceptions import GoogleAuthError
from google.cloud import pubsub_v1  # type: ignore[attr-defined]

from sentry.utils.json import dumps

from . import Analytics, Event

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

    def record_event(self, event: Event) -> None:
        if self.publisher is not None:
            self.publisher.publish(self.topic, data=dumps(event.serialize()).encode("utf-8"))
