import os
import subprocess
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from confluent_kafka.admin import AdminClient
from django.test import override_settings

from sentry.eventstream.kafka import KafkaEventStream
from sentry.testutils import TestCase
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import wait_for_topics

try:
    from confluent_kafka import Consumer, KafkaError, Producer, TopicPartition

    from sentry.eventstream.kafka.consumer import SynchronizedConsumer
except ImportError:
    pass

from django.conf import settings

SENTRY_KAFKA_HOSTS = os.environ.get("SENTRY_KAFKA_HOSTS", "127.0.0.1:9092")
SENTRY_ZOOKEEPER_HOSTS = os.environ.get("SENTRY_ZOOKEEPER_HOSTS", "127.0.0.1:2181")
settings.KAFKA_CLUSTERS["default"] = {"common": {"bootstrap.servers": SENTRY_KAFKA_HOSTS}}


@contextmanager
def create_topic(partitions=1, replication_factor=1):
    command = ["docker", "exec", "sentry_kafka", "kafka-topics"] + [
        "--zookeeper",
        SENTRY_ZOOKEEPER_HOSTS,
    ]
    topic = f"test-{uuid.uuid1().hex}"
    subprocess.check_call(
        command
        + [
            "--create",
            "--topic",
            topic,
            "--partitions",
            f"{partitions}",
            "--replication-factor",
            f"{replication_factor}",
        ]
    )
    try:
        yield topic
    finally:
        subprocess.check_call(command + ["--delete", "--topic", topic])


def test_consumer_start_from_partition_start():
    synchronize_commit_group = f"consumer-{uuid.uuid1().hex}"

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": SENTRY_KAFKA_HOSTS,
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic() as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(3):
            producer.produce(topic, f"{i}".encode())

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # Create the synchronized consumer.
        consumer = SynchronizedConsumer(
            cluster_name="default",
            consumer_group=f"consumer-{uuid.uuid1().hex}",
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
        for i in range(10):  # this takes a while
            assert consumer.poll(1) is None
            if assignments_received:
                break

        assert len(assignments_received) == 1, "expected to receive partition assignment"
        assert {(i.topic, i.partition) for i in assignments_received[0]} == {(topic, 0)}

        # TODO: Make sure that all partitions remain paused.

        # Make sure that there are no messages ready to consume.
        assert consumer.poll(1) is None

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0]
        producer.produce(
            commit_log_topic,
            key=f"{message.topic()}:{message.partition()}:{synchronize_commit_group}".encode(),
            value=f"{message.offset() + 1}".encode(),
        )

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # We should have received a single message.
        # TODO: Can we also assert that the position is unpaused?)
        for i in range(5):
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


def test_consumer_start_from_committed_offset():
    consumer_group = f"consumer-{uuid.uuid1().hex}"
    synchronize_commit_group = f"consumer-{uuid.uuid1().hex}"

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": SENTRY_KAFKA_HOSTS,
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic() as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(3):
            producer.produce(topic, f"{i}".encode())

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        Consumer({"bootstrap.servers": SENTRY_KAFKA_HOSTS, "group.id": consumer_group}).commit(
            message=messages_delivered[topic][0], asynchronous=False
        )

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
        for i in range(10):  # this takes a while
            assert consumer.poll(1) is None
            if assignments_received:
                break

        assert len(assignments_received) == 1, "expected to receive partition assignment"
        assert {(i.topic, i.partition) for i in assignments_received[0]} == {(topic, 0)}

        # TODO: Make sure that all partitions are paused on assignment.

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0]
        producer.produce(
            commit_log_topic,
            key=f"{message.topic()}:{message.partition()}:{synchronize_commit_group}".encode(),
            value=f"{message.offset() + 1}".encode(),
        )

        # Make sure that there are no messages ready to consume.
        assert consumer.poll(1) is None

        # Move the committed offset forward for our synchronizing group.
        message = messages_delivered[topic][0 + 1]  # second message
        producer.produce(
            commit_log_topic,
            key=f"{message.topic()}:{message.partition()}:{synchronize_commit_group}".encode(),
            value=f"{message.offset() + 1}".encode(),
        )

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        # We should have received a single message.
        # TODO: Can we also assert that the position is unpaused?)
        for i in range(5):
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


def test_consumer_rebalance_from_partition_start():
    consumer_group = f"consumer-{uuid.uuid1().hex}"
    synchronize_commit_group = f"consumer-{uuid.uuid1().hex}"

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": SENTRY_KAFKA_HOSTS,
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, f"{i}".encode(), partition=i % 2)

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
        for i in range(10):  # this takes a while
            assert consumer_a.poll(1) is None
            if assignments_received[consumer_a]:
                break

        assert (
            len(assignments_received[consumer_a]) == 1
        ), "expected to receive partition assignment"
        assert {(i.topic, i.partition) for i in assignments_received[consumer_a][0]} == {
            (topic, 0),
            (topic, 1),
        }

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
            for i in range(10):  # this takes a while
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

        assert set(assignments.keys()) == {(topic, 0), (topic, 1)}

        for expected_message in messages_delivered[topic]:
            consumer = assignments[(expected_message.topic(), expected_message.partition())]

            # Make sure that there are no messages ready to consume.
            assert consumer.poll(1) is None

            # Move the committed offset forward for our synchronizing group.
            producer.produce(
                commit_log_topic,
                key=f"{expected_message.topic()}:{expected_message.partition()}:{synchronize_commit_group}".encode(),
                value=f"{expected_message.offset() + 1}".encode(),
            )

            assert producer.flush(5) == 0, "producer did not successfully flush queue"

            received_message = consumer.poll(5.0)

            assert received_message is not None, "no message received"

            assert received_message.topic() == expected_message.topic()
            assert received_message.partition() == expected_message.partition()
            assert received_message.offset() == expected_message.offset()

            # We should not be able to continue reading into the topic.
            # TODO: Can we assert that the position is paused?
            assert consumer.poll(1) is None


def test_consumer_rebalance_from_committed_offset():
    consumer_group = f"consumer-{uuid.uuid1().hex}"
    synchronize_commit_group = f"consumer-{uuid.uuid1().hex}"

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": SENTRY_KAFKA_HOSTS,
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, f"{i}".encode(), partition=i % 2)

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        Consumer({"bootstrap.servers": SENTRY_KAFKA_HOSTS, "group.id": consumer_group}).commit(
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
        for i in range(10):  # this takes a while
            assert consumer_a.poll(1) is None
            if assignments_received[consumer_a]:
                break

        assert (
            len(assignments_received[consumer_a]) == 1
        ), "expected to receive partition assignment"
        assert {(i.topic, i.partition) for i in assignments_received[consumer_a][0]} == {
            (topic, 0),
            (topic, 1),
        }

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
            for i in range(10):  # this takes a while
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

        assert set(assignments.keys()) == {(topic, 0), (topic, 1)}

        for expected_message in messages_delivered[topic][2:]:
            consumer = assignments[(expected_message.topic(), expected_message.partition())]

            # Make sure that there are no messages ready to consume.
            assert consumer.poll(1) is None

            # Move the committed offset forward for our synchronizing group.
            producer.produce(
                commit_log_topic,
                key=f"{expected_message.topic()}:{expected_message.partition()}:{synchronize_commit_group}".encode(),
                value=f"{expected_message.offset() + 1}".encode(),
            )

            assert producer.flush(5) == 0, "producer did not successfully flush queue"

            # We should have received a single message.
            # TODO: Can we also assert that the position is unpaused?)
            received_message = consumer.poll(5.0)

            assert received_message is not None, "no message received"

            assert received_message.topic() == expected_message.topic()
            assert received_message.partition() == expected_message.partition()
            assert received_message.offset() == expected_message.offset()

            # We should not be able to continue reading into the topic.
            # TODO: Can we assert that the position is paused?
            assert consumer.poll(1) is None


def consume_until_constraints_met(consumer, constraints, iterations, timeout=1):
    constraints = set(constraints)

    for i in range(iterations):
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
def test_consumer_rebalance_from_uncommitted_offset():
    consumer_group = f"consumer-{uuid.uuid1().hex}"
    synchronize_commit_group = f"consumer-{uuid.uuid1().hex}"

    messages_delivered = defaultdict(list)

    def record_message_delivered(error, message):
        assert error is None
        messages_delivered[message.topic()].append(message)

    producer = Producer(
        {
            "bootstrap.servers": SENTRY_KAFKA_HOSTS,
            "on_delivery": record_message_delivered,
        }
    )

    with create_topic(partitions=2) as topic, create_topic() as commit_log_topic:

        # Produce some messages into the topic.
        for i in range(4):
            producer.produce(topic, f"{i}".encode(), partition=i % 2)

        assert producer.flush(5) == 0, "producer did not successfully flush queue"

        for (topic, partition), offset in {
            (message.topic(), message.partition()): message.offset()
            for message in messages_delivered[topic]
        }.items():
            producer.produce(
                commit_log_topic,
                key=f"{topic}:{partition}:{synchronize_commit_group}".encode(),
                value=f"{offset + 1}".encode(),
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
        assert {(i.topic, i.partition) for i in assignments_received[consumer_a][0]} == {
            (topic, 0),
            (topic, 1),
        }
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


def kafka_message_payload():
    return [
        2,
        "insert",
        {
            "group_id": 43,
            "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f",
            "organization_id": 1,
            "project_id": 1,
            "primary_hash": "311ee66a5b8e697929804ceb1c456ffe",
        },
        {
            "is_new": False,
            "is_regression": None,
            "is_new_group_environment": False,
            "queue": "post_process_errors",
            "skip_consume": False,
            "group_states": None,
        },
    ]


class BatchedConsumerTest(TestCase):
    def _get_producer(self, cluster_name):
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    def setUp(self):
        super().setUp()
        self.events_topic = f"events-{uuid.uuid4().hex}"
        self.commit_log_topic = f"events-commit-{uuid.uuid4().hex}"
        self.override_settings_cm = override_settings(
            KAFKA_EVENTS=self.events_topic,
            KAFKA_TRANSACTIONS=self.events_topic,
            KAFKA_TOPICS={
                self.events_topic: {"cluster": "default"},
            },
        )
        self.override_settings_cm.__enter__()

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)
        wait_for_topics(self.admin_client, [self.events_topic, self.commit_log_topic])

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        self.admin_client.delete_topics([self.events_topic, self.commit_log_topic])

    @patch(
        "sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task", autospec=True
    )
    def test_post_process_forwarder_batch_consumer(self, dispatch_post_process_group_task):
        consumer_group = f"consumer-{uuid.uuid1().hex}"
        synchronize_commit_group = f"sync-consumer-{uuid.uuid1().hex}"

        events_producer = self._get_producer("default")
        commit_log_producer = self._get_producer("default")
        message = json.dumps(kafka_message_payload()).encode()

        eventstream = KafkaEventStream()
        consumer = eventstream._build_consumer(
            consumer_group=consumer_group,
            topic=self.events_topic,
            commit_log_topic=self.commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            commit_batch_size=1,
            commit_batch_timeout_ms=100,
            concurrency=1,
            initial_offset_reset="earliest",
        )

        # produce message to the events topic
        events_producer.produce(self.events_topic, message)
        assert events_producer.flush(5) == 0, "events producer did not successfully flush queue"

        # Move the committed offset forward for our synchronizing group.
        commit_log_producer.produce(
            self.commit_log_topic,
            key=f"{self.events_topic}:0:{synchronize_commit_group}".encode(),
            value=f"{1}".encode(),
        )
        assert (
            commit_log_producer.flush(5) == 0
        ), "snuba-commit-log producer did not successfully flush queue"

        # Run the loop for sometime
        for _ in range(3):
            consumer._run_once()
            time.sleep(1)

        # Verify that the task gets called once
        dispatch_post_process_group_task.assert_called_once_with(
            event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
            project_id=1,
            group_id=43,
            primary_hash="311ee66a5b8e697929804ceb1c456ffe",
            is_new=False,
            is_regression=None,
            queue="post_process_errors",
            is_new_group_environment=False,
            group_states=None,
        )

    @patch(
        "sentry.eventstream.kafka.consumer_strategy.dispatch_post_process_group_task", autospec=True
    )
    def test_post_process_forwarder_streaming_consumer(self, dispatch_post_process_group_task):
        consumer_group = f"consumer-{uuid.uuid1().hex}"
        synchronize_commit_group = f"sync-consumer-{uuid.uuid1().hex}"

        events_producer = self._get_producer("default")
        commit_log_producer = self._get_producer("default")
        message = json.dumps(kafka_message_payload()).encode()

        eventstream = KafkaEventStream()
        consumer = eventstream._build_streaming_consumer(
            consumer_group=consumer_group,
            topic=self.events_topic,
            commit_log_topic=self.commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            commit_batch_size=1,
            commit_batch_timeout_ms=100,
            concurrency=1,
            initial_offset_reset="earliest",
            strict_offset_reset=None,
        )

        # produce message to the events topic
        events_producer.produce(self.events_topic, message)
        assert events_producer.flush(5) == 0, "events producer did not successfully flush queue"

        # Move the committed offset forward for our synchronizing group.
        commit_log_producer.produce(
            self.commit_log_topic,
            key=f"{self.events_topic}:0:{synchronize_commit_group}".encode(),
            value=f"{1}".encode(),
        )
        assert (
            commit_log_producer.flush(5) == 0
        ), "snuba-commit-log producer did not successfully flush queue"

        # Run the loop for sometime
        for _ in range(3):
            consumer._run_once()
            time.sleep(1)

        # Verify that the task gets called once
        dispatch_post_process_group_task.assert_called_once_with(
            event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
            project_id=1,
            group_id=43,
            primary_hash="311ee66a5b8e697929804ceb1c456ffe",
            is_new=False,
            is_regression=None,
            queue="post_process_errors",
            is_new_group_environment=False,
            group_states=None,
        )

        consumer.signal_shutdown()
