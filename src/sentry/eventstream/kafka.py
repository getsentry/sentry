from __future__ import absolute_import

import logging

from confluent_kafka import Producer
from django.utils.functional import cached_property

from sentry import quotas
from sentry.models import Organization
from sentry.eventstream.base import EventStream
from sentry.utils import json

logger = logging.getLogger(__name__)


# Beware! Changing this, or the message format/fields themselves requires
# consideration of all downstream consumers.
# Version 1 format: (1, '(insert|delete)', {...event json...}, {...state for post-processing...})
EVENT_PROTOCOL_VERSION = 1


class KafkaEventStream(EventStream):
    def __init__(self, publish_topic='events', producer_configuration=None, **options):
        if producer_configuration is None:
            producer_configuration = {}

        self.publish_topic = publish_topic
        self.producer_configuration = producer_configuration

    @cached_property
    def producer(self):
        return Producer(self.producer_configuration)

    def delivery_callback(self, error, message):
        if error is not None:
            logger.warning('Could not publish event (error: %s): %r', error, message)

    def publish(self, group, event, is_new, is_sample, is_regression, is_new_group_environment, primary_hash, skip_consume=False):
        project = event.project
        retention_days = quotas.get_event_retention(
            organization=Organization(project.organization_id)
        )

        # Polling the producer is required to ensure callbacks are fired. This
        # means that the latency between a message being delivered (or failing
        # to be delivered) and the corresponding callback being fired is
        # roughly the same as the duration of time that passes between publish
        # calls. If this ends up being too high, the publisher should be moved
        # into a background thread that can poll more frequently without
        # interfering with request handling. (This does `poll` does not act as
        # a heartbeat for the purposes of any sort of session expiration.)
        self.producer.poll(0.0)

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
                'data': dict(event.data.items()),
                'primary_hash': primary_hash,
                'retention_days': retention_days,
            }, {
                'is_new': is_new,
                'is_sample': is_sample,
                'is_regression': is_regression,
                'is_new_group_environment': is_new_group_environment,
            })
            self.producer.produce(
                self.publish_topic,
                key=key.encode('utf-8'),
                value=json.dumps(value),
                on_delivery=self.delivery_callback,
            )
        except Exception as error:
            logger.warning('Could not publish event: %s', error, exc_info=True)
            raise
