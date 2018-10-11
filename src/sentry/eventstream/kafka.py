from __future__ import absolute_import

from datetime import datetime
import logging
import pytz
import six
from uuid import uuid4

from confluent_kafka import Producer
from django.utils.functional import cached_property

from sentry import quotas
from sentry.models import Organization
from sentry.eventstream.base import EventStream
from sentry.utils import json

logger = logging.getLogger(__name__)


# Beware! Changing this, or the message format/fields themselves requires
# consideration of all downstream consumers.
EVENT_PROTOCOL_VERSION = 2

# Version 1 format: (1, TYPE, [...REST...])
#   Insert: (1, 'insert', {
#       ...event json...
#   }, {
#       ...state for post-processing...
#   })
#
#   Mutations that *should be ignored*: (1, ('delete_groups'|'unmerge'|'merge'), {...})
#
#   In short, for protocol version 1 only messages starting with (1, 'insert', ...)
#   should be processed.

# Version 2 format: (2, TYPE, [...REST...])
#   Insert: (2, 'insert', {
#       ...event json...
#   }, {
#       ...state for post-processing...
#   })
#   Delete Groups: (2, '(start_delete_groups|end_delete_groups)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'group_ids': [id2, id2, id3],
#       'datetime': timestamp,
#   })
#   Merge: (2, '(start_merge|end_merge)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'previous_group_ids': [id2, id2],
#       'new_group_id': id,
#       'datetime': timestamp,
#   })
#   Unmerge: (2, '(start_unmerge|end_unmerge)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'previous_group_id': id,
#       'new_group_id': id,
#       'hashes': [hash2, hash2]
#       'datetime': timestamp,
#   })


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

    def _send(self, project_id, _type, extra_data=(), asynchronous=True):
        # Polling the producer is required to ensure callbacks are fired. This
        # means that the latency between a message being delivered (or failing
        # to be delivered) and the corresponding callback being fired is
        # roughly the same as the duration of time that passes between publish
        # calls. If this ends up being too high, the publisher should be moved
        # into a background thread that can poll more frequently without
        # interfering with request handling. (This does `poll` does not act as
        # a heartbeat for the purposes of any sort of session expiration.)
        # Note that this call to poll() is *only* dealing with earlier
        # asynchronous produce() calls from the same process.
        self.producer.poll(0.0)

        assert isinstance(extra_data, tuple)
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

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            self.producer.flush()

    def insert(self, group, event, is_new, is_sample, is_regression,
               is_new_group_environment, primary_hash, skip_consume=False):
        # ensure the superclass's insert() is called, regardless of what happens
        # attempting to send to Kafka
        super(KafkaEventStream, self).insert(
            group, event, is_new, is_sample,
            is_regression, is_new_group_environment,
            primary_hash, skip_consume
        )

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

    def start_delete_groups(self, project_id, group_ids):
        if not group_ids:
            return

        state = {
            'transaction_id': uuid4().hex,
            'project_id': project_id,
            'group_ids': group_ids,
            'datetime': datetime.now(tz=pytz.utc),
        }

        self._send(
            project_id,
            'start_delete_groups',
            extra_data=(state,),
            asynchronous=False
        )

        return state

    def end_delete_groups(self, state):
        state = state.copy()
        state['datetime'] = datetime.now(tz=pytz.utc)
        self._send(
            state['project_id'],
            'end_delete_groups',
            extra_data=(state,),
            asynchronous=False
        )

    def start_merge(self, project_id, previous_group_ids, new_group_id):
        if not previous_group_ids:
            return

        state = {
            'transaction_id': uuid4().hex,
            'project_id': project_id,
            'previous_group_ids': previous_group_ids,
            'new_group_id': new_group_id,
            'datetime': datetime.now(tz=pytz.utc),
        }

        self._send(
            project_id,
            'start_merge',
            extra_data=(state,),
            asynchronous=False
        )

    def end_merge(self, state):
        state = state.copy()
        state['datetime'] = datetime.now(tz=pytz.utc)
        self._send(
            state['project_id'],
            'end_merge',
            extra_data=(state,),
            asynchronous=False
        )

    def start_unmerge(self, project_id, hashes, previous_group_id, new_group_id):
        if not hashes:
            return

        state = {
            'transaction_id': uuid4().hex,
            'project_id': project_id,
            'previous_group_id': previous_group_id,
            'new_group_id': new_group_id,
            'hashes': hashes,
            'datetime': datetime.now(tz=pytz.utc),
        }

        self._send(
            project_id,
            'start_unmerge',
            extra_data=(state,),
            asynchronous=False
        )

        return state

    def end_unmerge(self, state):
        state = state.copy()
        state['datetime'] = datetime.now(tz=pytz.utc)
        self._send(
            state['project_id'],
            'end_unmerge',
            extra_data=(state,),
            asynchronous=False
        )
