from __future__ import absolute_import

import six
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
# Version 1 format: (1, TYPE, [...REST...])
#   Insert: (1, 'insert', {...event json...}, {...state for post-processing...})
#   Delete Groups: (1, 'delete_groups', {'project_id': id, 'group_ids': [id1, id2, id3]})
#   Unmerge: (1, 'unmerge', {'project_id': id, 'new_group_id': id, 'event_ids': [id1, id2]})
#   Merge: (1, 'merge', {'project_id': id, 'previous_group_id': id, 'new_group_id': id})
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
            logger.warning('Could not publish message (error: %s): %r', error, message)

    def _send(self, project_id, _type, extra_data=()):
        assert isinstance(extra_data, tuple)

        # Polling the producer is required to ensure callbacks are fired. This
        # means that the latency between a message being delivered (or failing
        # to be delivered) and the corresponding callback being fired is
        # roughly the same as the duration of time that passes between publish
        # calls. If this ends up being too high, the publisher should be moved
        # into a background thread that can poll more frequently without
        # interfering with request handling. (This does `poll` does not act as
        # a heartbeat for the purposes of any sort of session expiration.)
        self.producer.poll(0.0)

        key = six.text_type(project_id)

        try:
            self.producer.produce(
                self.publish_topic,
                key=key.encode('utf-8'),
                value=json.dumps(
                    (EVENT_PROTOCOL_VERSION, _type) + extra_data
                ),
                on_delivery=self.delivery_callback,
            )
        except Exception as error:
            logger.warning('Could not publish message: %s', error, exc_info=True)
            raise

    def insert(self, group, event, is_new, is_sample, is_regression,
               is_new_group_environment, primary_hash, skip_consume=False):
        project = event.project
        retention_days = quotas.get_event_retention(
            organization=Organization(project.organization_id)
        )

        self._send(project.id, 'insert', extra_data=({
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
        },))

    def unmerge(self, project_id, new_group_id, event_ids):
        if not event_ids:
            return

        self._send(project_id, 'unmerge', extra_data=({
            'project_id': project_id,
            'new_group_id': new_group_id,
            'event_ids': event_ids,
        },))

    def delete_groups(self, project_id, group_ids):
        if not group_ids:
            return

        self._send(project_id, 'delete_groups', extra_data=({
            'project_id': project_id,
            'group_ids': group_ids,
        },))

    def merge(self, project_id, previous_group_id, new_group_id):
        self._send(project_id, 'merge', extra_data=({
            'project_id': project_id,
            'previous_group_id': previous_group_id,
            'new_group_id': new_group_id,
        },))
