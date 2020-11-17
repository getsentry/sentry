from __future__ import absolute_import

import os
import subprocess
import uuid
from collections import defaultdict
from contextlib import contextmanager

import pytest

from six.moves import xrange

try:
    from confluent_kafka import Consumer, KafkaError, Producer, TopicPartition
    from sentry.eventstream.kafka.consumer import SynchronizedConsumer
except ImportError:
    pass

from django.conf import settings

settings.KAFKA_CLUSTERS["default"] = {
    "common": {"bootstrap.servers": os.environ.get("SENTRY_KAFKA_HOSTS", "localhost:9092")}
}


@contextmanager
def create_topic(partitions=1, replication_factor=1):
    command = ["docker", "exec", "sentry_kafka", "kafka-topics"] + [
        "--zookeeper",
        os.environ["SENTRY_ZOOKEEPER_HOSTS"],
    ]
    topic = "test-{}".format(uuid.uuid1().hex)
    subprocess.check_call(
        command
        + [
            "--create",
            "--topic",
            topic,
            "--partitions",
            "{}".format(partitions),
            "--replication-factor",
            "{}".format(replication_factor),
        ]
    )
    try:
        yield topic
    finally:
        subprocess.check_call(command + ["--delete", "--topic", topic])


def test_consumer_start_from_partition_start(requires_kafka):
    synchronize_commit_group = "consumer-{}".format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"],
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic() as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(3):
            producer.produce(topic, "{}".format(i).encode("utf8"))

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # Create the synchronized consumer.
        consumer = SynchronizedConsumer(
            cluster_name="default",
            consumer_group="consumer-{}".format(uuid.uuid1().hex),
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        assignments_received = []

        def on_assign(c, assignment):
            assert c is consumer
            assignments_received.append(assignment)

        consumer.subscribe([topic], on_assign=on_assign)

        # Wait until we have received our assignments.
        for i in xrange(10):  # this takes a while
            assert consumer.poll(1) is None
            if assignments_received:
                break

        assert len(assignments_received) == 1, "expected to receive partition assignment"
        assert set((i.topic, i.partition) for i in assignments_received[0]) == set([(topic, 0)])

        # TODO: Make sure that all partitions remain paused.

        # Make sure that there are no messages ready to consume.
        assert consumer.poll(1) is None

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0]
        producer.produce(
            commit_log_topic,
            key="{}:{}:{}".format(
                message.topic(), message.partition(), synchronize_commit_group
            ).encode("utf8"),
            value="{}".format(message.offset() + 1).encode("utf8"),
        )

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # We should have received a single message.
        # TODO: Can we also assert that the position is unpaused?)
        for i in xrange(5):
            message = consumer.poll(1)
            if message is not None:
                break

        assert message is not None, "no message received"

        expected_message = messages_delivered[topic][0]
        assert message.topic() == expected_message.topic()
        assert message.partition() == expected_message.partition()
        assert message.offset() == expected_message.offset()

        # We should not be able to continue reading into the topic.
        # TODO: Can we assert that the position is paused?
        assert consumer.poll(1) is None


def test_consumer_start_from_committed_offset(requires_kafka):
    consumer_group = "consumer-{}".format(uuid.uuid1().hex)
    synchronize_commit_group = "consumer-{}".format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"],
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic() as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(3):
            producer.produce(topic, "{}".format(i).encode("utf8"))

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        Consumer(
            {"bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"], "group.id": consumer_group}
        ).commit(message=messages_delivered[topic][0], asynchronous=False)

        # Create the synchronized consumer.
        consumer = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        assignments_received = []

        def on_assign(c, assignment):
            assert c is consumer
            assignments_received.append(assignment)

        consumer.subscribe([topic], on_assign=on_assign)

        # Wait until we have received our assignments.
        for i in xrange(10):  # this takes a while
            assert consumer.poll(1) is None
            if assignments_received:
                break

        assert len(assignments_received) == 1, "expected to receive partition assignment"
        assert set((i.topic, i.partition) for i in assignments_received[0]) == set([(topic, 0)])

        # TODO: Make sure that all partitions are paused on assignment.

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0]
        producer.produce(
            commit_log_topic,
            key="{}:{}:{}".format(
                message.topic(), message.partition(), synchronize_commit_group
            ).encode("utf8"),
            value="{}".format(message.offset() + 1).encode("utf8"),
        )

        # Make sure that there are no messages ready to consume.
        assert consumer.poll(1) is None

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0 + 1]  # second message
        producer.produce(
            commit_log_topic,
            key="{}:{}:{}".format(
                message.topic(), message.partition(), synchronize_commit_group
            ).encode("utf8"),
            value="{}".format(message.offset() + 1).encode("utf8"),
        )

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # We should have received a single message.
        # TODO: Can we also assert that the position is unpaused?)
        for i in xrange(5):
            message = consumer.poll(1)
            if message is not None:
                break

        assert message is not None, "no message received"

        expected_message = messages_delivered[topic][0 + 1]  # second message
        assert message.topic() == expected_message.topic()
        assert message.partition() == expected_message.partition()
        assert message.offset() == expected_message.offset()

        # We should not be able to continue reading into the topic.
        # TODO: Can we assert that the position is paused?
        assert consumer.poll(1) is None


def test_consumer_rebalance_from_partition_start(requires_kafka):
    consumer_group = "consumer-{}".format(uuid.uuid1().hex)
    synchronize_commit_group = "consumer-{}".format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"],
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, "{}".format(i).encode("utf8"), partition=i % 2)

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        consumer_a = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        assignments_received = defaultdict(list)

        def on_assign(consumer, assignment):
            assignments_received[consumer].append(assignment)

        consumer_a.subscribe([topic], on_assign=on_assign)

        # Wait until the first consumer has received its assignments.
        for i in xrange(10):  # this takes a while
            assert consumer_a.poll(1) is None
            if assignments_received[consumer_a]:
                break

        assert (
            len(assignments_received[consumer_a]) == 1
        ), "expected to receive partition assignment"
        assert set((i.topic, i.partition) for i in assignments_received[consumer_a][0]) == set(
            [(topic, 0), (topic, 1)]
        )

        assignments_received[consumer_a].pop()
        consumer_b = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        consumer_b.subscribe([topic], on_assign=on_assign)

        assignments = {}

        # Wait until *both* consumers have received updated assignments.
        for consumer in [consumer_a, consumer_b]:
            for i in xrange(10):  # this takes a while
                assert consumer.poll(1) is None
                if assignments_received[consumer]:
                    break

            assert (
                len(assignments_received[consumer]) == 1
            ), "expected to receive partition assignment"
            assert (
                len(assignments_received[consumer][0]) == 1
            ), "expected to have a single partition assignment"

            i = assignments_received[consumer][0][0]
            assignments[(i.topic, i.partition)] = consumer

        assert set(assignments.keys()) == set([(topic, 0), (topic, 1)])

        for expected_message in messages_delivered[topic]:
            consumer = assignments[(expected_message.topic(), expected_message.partition())]

            # Make sure that there are no messages ready to consume.
            assert consumer.poll(1) is None

            # Move the committed offset forward for our synchronizing group.
            producer.produce(
                commit_log_topic,
                key="{}:{}:{}".format(
                    expected_message.topic(), expected_message.partition(), synchronize_commit_group
                ).encode("utf8"),
                value="{}".format(expected_message.offset() + 1).encode("utf8"),
            )

            assert producer.flush(5) == 0, "producer did not successfully flush queue"

            # We should have received a single message.
            # TODO: Can we also assert that the position is unpaused?)
            for i in xrange(5):
                received_message = consumer.poll(1)
                if received_message is not None:
                    break

            assert received_message is not None, "no message received"

            assert received_message.topic() == expected_message.topic()
            assert received_message.partition() == expected_message.partition()
            assert received_message.offset() == expected_message.offset()

            # We should not be able to continue reading into the topic.
            # TODO: Can we assert that the position is paused?
            assert consumer.poll(1) is None


def test_consumer_rebalance_from_committed_offset(requires_kafka):
    consumer_group = "consumer-{}".format(uuid.uuid1().hex)
    synchronize_commit_group = "consumer-{}".format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"],
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, "{}".format(i).encode("utf8"), partition=i % 2)

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        Consumer(
            {"bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"], "group.id": consumer_group}
        ).commit(
            offsets=[
                TopicPartition(message.topic(), message.partition(), message.offset() + 1)
                for message in messages_delivered[topic][:2]
            ],
            asynchronous=False,
        )

        consumer_a = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        assignments_received = defaultdict(list)

        def on_assign(consumer, assignment):
            assignments_received[consumer].append(assignment)

        consumer_a.subscribe([topic], on_assign=on_assign)

        # Wait until the first consumer has received its assignments.
        for i in xrange(10):  # this takes a while
            assert consumer_a.poll(1) is None
            if assignments_received[consumer_a]:
                break

        assert (
            len(assignments_received[consumer_a]) == 1
        ), "expected to receive partition assignment"
        assert set((i.topic, i.partition) for i in assignments_received[consumer_a][0]) == set(
            [(topic, 0), (topic, 1)]
        )

        assignments_received[consumer_a].pop()

        consumer_b = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        consumer_b.subscribe([topic], on_assign=on_assign)

        assignments = {}

        # Wait until *both* consumers have received updated assignments.
        for consumer in [consumer_a, consumer_b]:
            for i in xrange(10):  # this takes a while
                assert consumer.poll(1) is None
                if assignments_received[consumer]:
                    break

            assert (
                len(assignments_received[consumer]) == 1
            ), "expected to receive partition assignment"
            assert (
                len(assignments_received[consumer][0]) == 1
            ), "expected to have a single partition assignment"

            i = assignments_received[consumer][0][0]
            assignments[(i.topic, i.partition)] = consumer

        assert set(assignments.keys()) == set([(topic, 0), (topic, 1)])

        for expected_message in messages_delivered[topic][2:]:
            consumer = assignments[(expected_message.topic(), expected_message.partition())]

            # Make sure that there are no messages ready to consume.
            assert consumer.poll(1) is None

            # Move the committed offset forward for our synchronizing group.
            producer.produce(
                commit_log_topic,
                key="{}:{}:{}".format(
                    expected_message.topic(), expected_message.partition(), synchronize_commit_group
                ).encode("utf8"),
                value="{}".format(expected_message.offset() + 1).encode("utf8"),
            )

            assert producer.flush(5) == 0, "producer did not successfully flush queue"

            # We should have received a single message.
            # TODO: Can we also assert that the position is unpaused?)
            for i in xrange(5):
                received_message = consumer.poll(1)
                if received_message is not None:
                    break

            assert received_message is not None, "no message received"

            assert received_message.topic() == expected_message.topic()
            assert received_message.partition() == expected_message.partition()
            assert received_message.offset() == expected_message.offset()

            # We should not be able to continue reading into the topic.
            # TODO: Can we assert that the position is paused?
            assert consumer.poll(1) is None


def consume_until_constraints_met(consumer, constraints, iterations, timeout=1):
    constraints = set(constraints)

    for i in xrange(iterations):
        message = consumer.poll(timeout)
        for constraint in list(constraints):
            if constraint(message):
                constraints.remove(constraint)

        if not constraints:
            break

    if constraints:
        raise AssertionError(
            "Completed {} iterations with {} unmet constraints: {!r}".format(
                iterations, len(constraints), constraints
            )
        )


def collect_messages_received(count):
    messages = []

    def messages_received_constraint(message):
        if message is not None:
            messages.append(message)
            if len(messages) == count:
                return True

    return messages_received_constraint


@pytest.mark.xfail(
    reason="assignment during rebalance requires partition rollback to last committed offset",
    run=False,
)
def test_consumer_rebalance_from_uncommitted_offset(requires_kafka):
    consumer_group = "consumer-{}".format(uuid.uuid1().hex)
    synchronize_commit_group = "consumer-{}".format(uuid.uuid1().hex)

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": os.environ["SENTRY_KAFKA_HOSTS"],
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, "{}".format(i).encode("utf8"), partition=i % 2)

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        for (topic, partition), offset in {
            (message.topic(), message.partition()): message.offset()
            for message in messages_delivered[topic]
        }.items():
            producer.produce(
                commit_log_topic,
                key="{}:{}:{}".format(topic, partition, synchronize_commit_group).encode("utf8"),
                value="{}".format(offset + 1).encode("utf8"),
            )

        assert producer.flush(5) == 0, "producer did not successfully flush queue"
        consumer_a = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        assignments_received = defaultdict(list)

        def on_assign(consumer, assignment):
            assignments_received[consumer].append(assignment)

        consumer_a.subscribe([topic], on_assign=on_assign)

        consume_until_constraints_met(
            consumer_a,
            [lambda message: assignments_received[consumer_a], collect_messages_received(4)],
            10,
        )

        assert (
            len(assignments_received[consumer_a]) == 1
        ), "expected to receive partition assignment"
        assert set((i.topic, i.partition) for i in assignments_received[consumer_a][0]) == set(
            [(topic, 0), (topic, 1)]
        )
        assignments_received[consumer_a].pop()

        message = consumer_a.poll(1)
        assert (
            message is None or message.error() is KafkaError._PARTITION_EOF
        ), "there should be no more messages to receive"

        consumer_b = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset="earliest",
        )

        consumer_b.subscribe([topic], on_assign=on_assign)

        consume_until_constraints_met(
            consumer_a, [lambda message: assignments_received[consumer_a]], 10
        )

        consume_until_constraints_met(
            consumer_b,
            [lambda message: assignments_received[consumer_b], collect_messages_received(2)],
            10,
        )

        for consumer in [consumer_a, consumer_b]:
            assert len(assignments_received[consumer][0]) == 1

        message = consumer_a.poll(1)
        assert (
            message is None or message.error() is KafkaError._PARTITION_EOF
        ), "there should be no more messages to receive"

        message = consumer_b.poll(1)
        assert (
            message is None or message.error() is KafkaError._PARTITION_EOF
        ), "there should be no more messages to receive"
