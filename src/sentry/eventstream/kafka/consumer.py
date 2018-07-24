from __future__ import absolute_import

import logging
import uuid

from confluent_kafka import Consumer, OFFSET_BEGINNING, TopicPartition

from sentry.eventstream.kafka.state import PartitionState, SynchronizedPartitionStateManager
from sentry.eventstream.kafka.utils import join


logger = logging.getLogger(__name__)


class SynchronizedConsumer(object):
    """
    This class implements the framework for a consumer that is intended to only
    consume messages that have already been consumed and committed by members
    of another consumer group.

    This works similarly to the Kafka built-in ``__consumer_offsets`` topic.
    The consumer group that is being "followed" (the one that must make
    progress for our consumer here to make progress, identified by the
    ``synchronize_commit_group`` constructor parameter/instance attribute) must
    report its offsets to a topic (identified by the ``commit_log_topic``
    constructor parameter/instance attribute). This consumer subscribes to both
    commit log topic, as well as the topic(s) that we are actually interested
    in consuming messages from. The messages received from the commit log topic
    control whether or not consumption from partitions belonging to the main
    topic is paused, resumed, or allowed to continue in its current state
    without changes.

    The furthest point in any partition that this consumer should ever consume
    to is the maximum offset that has been recorded to the commit log topic for
    that partition. If the offsets recorded to that topic move
    non-monotonically (due to an intentional offset rollback, for instance)
    this consumer *may* consume up to the highest watermark point. (The
    implementation here tries to pause consuming from the partition as soon as
    possible, but this makes no explicit guarantees about that behavior.)

    Subclasses are required to implement the ``handle`` method which is
    provided with a message that is ready to be processed as its only argument.
    Implementations are also responsible for managing their own offset commits.
    """

    def __init__(self, bootstrap_servers, topics, consumer_group,
                 commit_log_topic, synchronize_commit_group):
        self.bootstrap_servers = bootstrap_servers
        self.topics = topics
        self.consumer_group = consumer_group
        self.commit_log_topic = commit_log_topic
        self.synchronize_commit_group = synchronize_commit_group

    def _commit_callback(self, error, partitions):
        if error is not None:
            logger.warning(
                'Failed to commit offsets (error: %s, partitions: %r)',
                error,
                partitions)

    def _on_partition_state_change(
            self, topic, partition, previous_state_and_offsets, current_state_and_offsets):
        logger.debug('State change for %r: %r to %r', (topic, partition),
                     previous_state_and_offsets, current_state_and_offsets)

        current_state, current_offsets = current_state_and_offsets
        if current_offsets.local is None:
            # It only makes sense to manipulate the consumer if we've got an
            # assignment. (This block should only be entered at startup if the
            # remote offsets are retrieved from the commit log before the local
            # consumer has received its assignment.)
            return

        if current_state in (PartitionState.UNKNOWN, PartitionState.SYNCHRONIZED,
                             PartitionState.REMOTE_BEHIND):
            self._consumer.pause([TopicPartition(topic, partition, current_offsets.local)])
        elif current_state is PartitionState.LOCAL_BEHIND:
            self._consumer.resume([TopicPartition(topic, partition, current_offsets.local)])
        else:
            raise NotImplementedError('Unexpected partition state: %s' % (current_state,))

    def _get_initial_offset(self, consumer, i):
        low, high = self._consumer.get_watermark_offsets(i)
        return low

    def _pause_partitions_on_assignment(self, consumer, assignment):
        # Since ``auto.offset.reset`` is set to ``error`` to force human
        # interaction on an offset reset, we have to explicitly specify the
        # starting offset if no offset has been committed for this topic during
        # the ``__consumer_offsets`` topic retention period.
        assignment = [
            TopicPartition(
                i.topic,
                i.partition,
                i.offset if i.offset > -1 else self._get_initial_offset(consumer, i),
            ) for i in assignment
        ]

        self._consumer.assign(assignment)

        for i in assignment:
            # Setting the local offsets will either cause the partition to be
            # paused (if the remote offset is unknown or the local offset is
            # not trailing the remote offset) or resumed.
            self._partition_state_manager.set_local_offset(i.topic, i.partition, i.offset)

    def _rewind_partitions_on_assignment(self, consumer, assignment):
        # The commit log consumer must start consuming from the beginning of
        # the commit log topic to ensure that it has a comprehensive view of
        # all active partitions.
        consumer.assign([TopicPartition(i.topic, i.partition, OFFSET_BEGINNING)
                         for i in assignment])

    def get_commit_data(self, message):
        group, topic, partition = message.key().decode('utf-8').split(':', 3)
        partition = int(partition)
        offset = int(message.value().decode('utf-8'))
        return group, topic, partition, offset

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

        self._partition_state_manager = SynchronizedPartitionStateManager(
            self._on_partition_state_change)

        self._consumer.subscribe(self.topics, self._pause_partitions_on_assignment)

        # NOTE: The commit log consumer group should not be persisted into the
        # ``__consumer_offsets`` topic since no offsets are committed by this
        # consumer. The group membership metadata messages will be published
        # initially but as long as this group remains a single consumer it will
        # be deleted after the consumer is closed. It is very important to note
        # that the ``group.id`` **MUST** be unique to this consumer process!!!
        # (This ensures that it is able to consume from all partitions of the
        # commit log topic and get a comprehensive view of the state of the
        # consumer groups it is tracking.)
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
                self._partition_state_manager.validate_local_message(
                    message.topic(), message.partition(), message.offset())
                self.handle(message)
                self._partition_state_manager.set_local_offset(
                    message.topic(), message.partition(), message.offset() + 1)
            elif consumer is self._commit_log_consumer:
                group, topic, partition, offset = self.get_commit_data(message)
                if group != self.synchronize_commit_group:
                    logger.debug('Received consumer offsets update from %r, ignoring...', group)
                else:
                    self._partition_state_manager.set_remote_offset(topic, partition, offset)
            else:
                raise Exception('Received message from an unexpected consumer!')

    def handle(self, message):
        raise NotImplementedError

    def commit(self, *args, **kwargs):
        return self._consumer.commit(*args, **kwargs)
