from __future__ import absolute_import

__all__ = ('PubSubAnalytics',)

from sentry.utils.json import dumps
from google.cloud import pubsub_v1

from .base import Analytics


class PubSubAnalytics(Analytics):
    def __init__(self, project, topic, batch_max_bytes=1024 * 100, batch_max_latency=1):
        settings = pubsub_v1.types.BatchSettings(
            max_bytes=batch_max_bytes,
            max_latency=batch_max_latency,
        )
        self.publisher = pubsub_v1.PublisherClient(settings)
        self.topic = self.publisher.topic_path(project, topic)

    def record_event(self, event):
        self.publisher.publish(
            self.topic,
            data=dumps(event.serialize()),
        )
