from __future__ import absolute_import

import subprocess
import uuid
from collections import defaultdict
from contextlib import contextmanager

from confluent_kafka import Producer


@contextmanager
def create_topic(partitions=1, replication_factor=1):
    command = ['docker', 'exec', 'kafka', 'kafka-topics'] + ['--zookeeper', 'zookeeper:2181']
    topic = 'test-{}'.format(uuid.uuid1().hex)
    subprocess.check_call(command + [
        '--create',
        '--topic', topic,
        '--partitions', '{}'.format(partitions),
        '--replication-factor', '{}'.format(replication_factor),
    ])
    try:
        yield topic
    finally:
        subprocess.check_call(command + [
            '--delete',
            '--topic', topic,
        ])


def test_consumer_start_from_partition_start():
    synchronize_commit_group = 'consumer-{}'.format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer({
        'bootstrap.servers': 'localhost:9092',
        'on_delivery': record_message_delivered,
    })

    with create_topic() as topic, create_topic() as commit_log_topic:
        """
        # Create the synchronized consumer.
        consumer = SynchronizedConsumer()
        """

        # Produce some messages into the topic.
        for i in range(3):
            producer.produce(topic, '{}'.format(i).encode('utf8'))

        assert producer.flush(5) == 0, 'producer did not successfully flush queue'

        """
        # Ensure that the synchronized consumer does not have any messages ready to consume.
        # TODO: Can we also assert that the partition is paused?
        assert consumer.poll(1) is None
        """

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0]
        producer.produce(
            commit_log_topic,
            key='{}:{}:{}'.format(
                message.topic(),
                message.partition(),
                synchronize_commit_group,
            ).encode('utf8'),
            value='{}'.format(
                message.offset() + 1,
            ).encode('utf8'),
        )

        assert producer.flush(5) == 0, 'producer did not successfully flush queue'

        """
        # We should have received a single message.
        # TODO: Can we also assert that the position is unpaused?)
        message = consumer.poll(1)
        assert message.topic() == messages_delivered[0].topic()
        assert message.partition() == messages_delivered[0].partition()
        assert message.offset() == messages_delivered[0].offset()

        # We should not be able to continue reading into the topic.
        # TODO: Can we assert that the position is paused?
        assert consumer.poll(1) is None
        """


def test_consumer_start_from_committed_offset():
    raise NotImplementedError


def test_consumer_rebalance_from_partition_start():
    raise NotImplementedError


def test_consumer_rebalance_from_committed_offset():
    raise NotImplementedError


def test_consumer_rebalance_from_uncommitted_offset():
    raise NotImplementedError
