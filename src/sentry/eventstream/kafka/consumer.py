from __future__ import absolute_import

import logging
import uuid

from confluent_kafka import Consumer, OFFSET_BEGINNING, TopicPartition

from sentry.eventstream.kafka.state import PartitionState, SynchronizedPartitionStateManager
from sentry.eventstream.kafka.utils import join


logger = logging.getLogger(__name__)


class SynchronizedConsumer(object):
    def __init__(self, bootstrap_servers, topics, consumer_group, commit_log_topic, synchronize_commit_group):
        self.bootstrap_servers = bootstrap_servers
        self.topics = topics
        self.consumer_group = consumer_group
        self.commit_log_topic = commit_log_topic
        self.synchronize_commit_group = synchronize_commit_group

    def _commit_callback(self, error, partitions):
        if error is not None:
            logger.warning('Failed to commit offsets (error: %s, partitions: %r)', error, partitions)

    def _on_partition_state_change(self, topic, partition, previous_state_and_offsets, current_state_and_offsets):
        logger.debug('State change for %r: %r to %r', (topic, partition), previous_state_and_offsets, current_state_and_offsets)

        current_state, current_offsets = current_state_and_offsets
        if current_offsets.local is None:
            return  # it only makes sense to manipulate the consumer if we've got an assignment

        if current_state in (PartitionState.UNKNOWN, PartitionState.SYNCHRONIZED, PartitionState.REMOTE_BEHIND):
            self._consumer.pause([TopicPartition(topic, partition, current_offsets.local)])
        elif current_state is PartitionState.LOCAL_BEHIND:
            self._consumer.resume([TopicPartition(topic, partition, current_offsets.local)])
        else:
            raise NotImplementedError('Unexpected partition state: %s' % (current_state,))

    def _get_initial_offset(self, consumer, i):
        low, high = self._consumer.get_watermark_offsets(i)
        return low

    def _pause_partitions_on_assignment(self, consumer, assignment):
        assignment = [
            TopicPartition(
                i.topic,
                i.partition,
                i.offset if i.offset > -1 else self._get_initial_offset(consumer, i),
            ) for i in assignment
        ]

        self._consumer.assign(assignment)

        for i in assignment:
            self._partition_state_manager.set_local_offset(i.topic, i.partition, i.offset)

    def _rewind_partitions_on_assignment(self, consumer, assignment):
        consumer.assign([TopicPartition(i.topic, i.partition, OFFSET_BEGINNING) for i in assignment])

    def start(self):
        self._consumer = Consumer({
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.consumer_group,
            'enable.auto.commit': 'false',
            'enable.auto.offset.store': 'true',
            'enable.partition.eof': 'false',
            'default.topic.config': {
                'auto.offset.reset': 'error',
            },
            'on_commit': self._commit_callback,
        })

        self._partition_state_manager = SynchronizedPartitionStateManager(self._on_partition_state_change)

        self._consumer.subscribe(self.topics, self._pause_partitions_on_assignment)

        self._commit_log_consumer = Consumer({
            'bootstrap_servers': self.bootstrap_servers,
            'group.id': '{}:sync:{}'.format(self.consumer_group, uuid.uuid1.hex()),
            'enable.auto.commit': 'false',
            'enable.auto.offset.store': 'true',
            'enable.partition.eof': 'false',
            'default.topic.config': {
                'auto.offset.reset': 'error',
            },
        })

        self._commit_log_consumer.subscribe(
            [self.commit_log_topic],
            on_assign=self._rewind_partitions_on_assignment,
        )

        for consumer, message in join([self._commit_log_consumer, self._consumer]):
            if consumer is self._consumer:
                self._partition_state_manager.validate_local_message(message.topic(), message.partition(), message.offset())
                self.handle(message)
                self._partition_state_manager.set_local_offset(message.topic(), message.partition(), message.offset() + 1)
            elif consumer is self._commit_log_consumer:
                group, topic, partition = message.key().decode('utf-8').split(':', 3)
                partition = int(partition)
                if group != self.synchronize_commit_group:
                    logger.debug('Received consumer offsets update from %r, ignoring...', group)
                else:
                    offset = int(message.value().decode('utf-8'))
                    self._partition_state_manager.set_remote_offset(topic, partition, offset)
            else:
                raise Exception('Received message from an unexpected consumer!')

    def handle(self, message):
        raise NotImplementedError

    def commit(self, *args, **kwargs):
        return self._consumer.commit(*args, **kwargs)
