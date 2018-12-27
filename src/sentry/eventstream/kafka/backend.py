from __future__ import absolute_import

from datetime import datetime
import logging
import pytz
import six
from uuid import uuid4

from confluent_kafka import OFFSET_INVALID, Producer, TopicPartition
from django.utils.functional import cached_property

from sentry import options, quotas
from sentry.models import Organization
from sentry.eventstream.base import EventStream
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.protocol import get_task_kwargs_for_message
from sentry.tasks.post_process import post_process_group
from sentry.utils import json

logger = logging.getLogger(__name__)


# Beware! Changing this protocol (introducing a new version, or the message
# format/fields themselves) requires consideration of all downstream consumers.
# This includes the post-processing relay code!
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
                topic=self.publish_topic,
                key=key.encode('utf-8'),
                value=json.dumps(
                    (EVENT_PROTOCOL_VERSION, _type) + extra_data
                ),
                on_delivery=self.delivery_callback,
            )
        except Exception as error:
            logger.error('Could not publish message: %s', error, exc_info=True)
            return

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            self.producer.flush()

    def insert(self, group, event, is_new, is_sample, is_regression,
               is_new_group_environment, primary_hash, skip_consume=False):
        if options.get('eventstream.kafka.send-post_process-task'):
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
            # TODO(mitsuhiko): We do not want to send this incorrect
            # message but this is what snuba needs at the moment.
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
            'skip_consume': skip_consume,
        },))

    def start_delete_groups(self, project_id, group_ids):
        if not group_ids:
            return

        state = {
            'transaction_id': uuid4().hex,
            'project_id': project_id,
            'group_ids': list(group_ids),
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
            'previous_group_ids': list(previous_group_ids),
            'new_group_id': new_group_id,
            'datetime': datetime.now(tz=pytz.utc),
        }

        self._send(
            project_id,
            'start_merge',
            extra_data=(state,),
            asynchronous=False
        )

        return state

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
            'hashes': list(hashes),
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

    def relay(self, consumer_group, commit_log_topic,
              synchronize_commit_group, commit_batch_size=100, initial_offset_reset='latest'):
        logger.debug('Starting relay...')

        consumer = SynchronizedConsumer(
            bootstrap_servers=self.producer_configuration['bootstrap.servers'],
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset=initial_offset_reset,
        )

        owned_partition_offsets = {}

        def commit(partitions):
            results = consumer.commit(offsets=partitions, asynchronous=False)

            errors = filter(lambda i: i.error is not None, results)
            if errors:
                raise Exception(
                    'Failed to commit %s/%s partitions: %r' %
                    (len(errors), len(partitions), errors))

            return results

        def on_assign(consumer, partitions):
            logger.debug('Received partition assignment: %r', partitions)

            for i in partitions:
                if i.offset == OFFSET_INVALID:
                    updated_offset = None
                elif i.offset < 0:
                    raise Exception(
                        'Received unexpected negative offset during partition assignment: %r' %
                        (i,))
                else:
                    updated_offset = i.offset

                key = (i.topic, i.partition)
                previous_offset = owned_partition_offsets.get(key, None)
                if previous_offset is not None and previous_offset != updated_offset:
                    logger.warning(
                        'Received new offset for owned partition %r, will overwrite previous stored offset %r with %r.',
                        key,
                        previous_offset,
                        updated_offset)

                owned_partition_offsets[key] = updated_offset

        def on_revoke(consumer, partitions):
            logger.debug('Revoked partition assignment: %r', partitions)

            offsets_to_commit = []

            for i in partitions:
                key = (i.topic, i.partition)

                try:
                    offset = owned_partition_offsets.pop(key)
                except KeyError:
                    logger.warning(
                        'Received unexpected partition revocation for unowned partition: %r',
                        i,
                        exc_info=True)
                    continue

                if offset is None:
                    logger.debug('Skipping commit of unprocessed partition: %r', i)
                    continue

                offsets_to_commit.append(TopicPartition(i.topic, i.partition, offset))

            if offsets_to_commit:
                logger.debug(
                    'Committing offset(s) for %s revoked partition(s): %r',
                    len(offsets_to_commit),
                    offsets_to_commit)
                commit(offsets_to_commit)

        consumer.subscribe(
            [self.publish_topic],
            on_assign=on_assign,
            on_revoke=on_revoke,
        )

        def commit_offsets():
            offsets_to_commit = []
            for (topic, partition), offset in owned_partition_offsets.items():
                if offset is None:
                    logger.debug('Skipping commit of unprocessed partition: %r', (topic, partition))
                    continue

                offsets_to_commit.append(TopicPartition(topic, partition, offset))

            if offsets_to_commit:
                logger.debug(
                    'Committing offset(s) for %s owned partition(s): %r',
                    len(offsets_to_commit),
                    offsets_to_commit)
                commit(offsets_to_commit)

        try:
            i = 0
            while True:
                message = consumer.poll(0.1)
                if message is None:
                    continue

                error = message.error()
                if error is not None:
                    raise Exception(error)

                key = (message.topic(), message.partition())
                if key not in owned_partition_offsets:
                    logger.warning('Skipping message for unowned partition: %r', key)
                    continue

                i = i + 1
                owned_partition_offsets[key] = message.offset() + 1

                task_kwargs = get_task_kwargs_for_message(message.value())
                if task_kwargs is not None:
                    post_process_group.delay(**task_kwargs)

                if i % commit_batch_size == 0:
                    commit_offsets()
        except KeyboardInterrupt:
            pass

        logger.debug('Committing offsets and closing consumer...')
        commit_offsets()

        consumer.close()
