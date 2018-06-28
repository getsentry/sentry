from __future__ import absolute_import

import logging

from kafka import KafkaProducer
from django.utils.functional import cached_property

from sentry import quotas
from sentry.models import Organization
from sentry.eventstream.base import EventStream
from sentry.utils import json
from sentry.utils.pubsub import QueuedPublisher

logger = logging.getLogger(__name__)


# Beware! Changing this, or the message format/fields themselves requires
# consideration of all downstream consumers.
# Version 0 format: (0, '(insert|delete)', {..event json...})
EVENT_PROTOCOL_VERSION = 0


class KafkaPublisher(object):
    def __init__(self, connection):
        self.connection = connection or {}

    @cached_property
    def client(self):
        return KafkaProducer(**self.connection)

    def publish(self, topic, value, key=None):
        return self.client.send(topic, key=key, value=value)


class KafkaEventStream(EventStream):
    def __init__(self, topic='events', sync=False, connection=None, **options):
        self.topic = topic
        self.pubsub = KafkaPublisher(connection)
        if not sync:
            self.pubsub = QueuedPublisher(self.pubsub)

    def publish(self, event, primary_hash, **kwargs):
        project = event.project
        retention_days = quotas.get_event_retention(
            organization=Organization(project.organization_id)
        )

        try:
            key = '%s:%s' % (event.project_id, event.event_id)
            value = (EVENT_PROTOCOL_VERSION, 'insert', {
                'group_id': event.group_id,
                'event_id': event.event_id,
                'organization_id': project.organization_id,
                'project_id': event.project_id,
                'message': event.message,
                'platform': event.platform,
                'datetime': event.datetime,
                'data': event.data.data,
                'primary_hash': primary_hash,
                'retention_days': retention_days,
            })

            self.pubsub.publish(self.topic, key=key.encode('utf-8'), value=json.dumps(value))
        except Exception as error:
            logger.warning('Could not publish event: %s', error, exc_info=True)
            raise

        def consume(self, event, primary_hash, **kwargs):
            # TODO talk to Ted
            pass
