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
# Version 1 format: (1, '(insert|delete)', {...event json...}, {...state for post-processing...})
EVENT_PROTOCOL_VERSION = 1


class KafkaPublisher(object):
    def __init__(self, connection):
        self.connection = connection or {}

    @cached_property
    def client(self):
        return KafkaProducer(**self.connection)

    def publish(self, topic, value, key=None):
        return self.client.send(topic, key=key, value=value)


class KafkaEventStream(EventStream):
    def __init__(self, publish_topic='events', sync=False, connection=None, **options):
        self.publish_topic = publish_topic
        self.pubsub = KafkaPublisher(connection)
        if not sync:
            self.pubsub = QueuedPublisher(self.pubsub)

    def publish(self, group, event, is_new, is_sample, is_regression, is_new_group_environment, primary_hash, skip_consume=False):
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
            }, {
                'is_new': is_new,
                'is_sample': is_sample,
                'is_regression': is_regression,
                'is_new_group_environment': is_new_group_environment,
            })

            self.pubsub.publish(self.publish_topic, key=key.encode('utf-8'), value=json.dumps(value))
        except Exception as error:
            logger.warning('Could not publish event: %s', error, exc_info=True)
            raise
