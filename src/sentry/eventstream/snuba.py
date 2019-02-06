from __future__ import absolute_import

from sentry.eventstream.kafka import KafkaEventStream
from sentry.eventstream.kafka.backend import EVENT_PROTOCOL_VERSION
from sentry.utils import snuba


class SnubaEventStream(KafkaEventStream):
    def _send(self, project_id, _type, extra_data=(), asynchronous=True):
        snuba.test_eventstream((EVENT_PROTOCOL_VERSION, _type) + extra_data)
