import datetime
import logging
import random
import time
import uuid

import msgpack
import pytest
from django.conf import settings

from sentry import eventstore
from sentry.event_manager import EventManager
from sentry.ingest.consumer.factory import get_ingest_consumer
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import create_topics

pytestmark = [requires_snuba, requires_kafka]

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100

# Block size for shared memory of the multiprocessing kafka consumer strategy.
# Any reasonable value will do for tests.
DEFAULT_BLOCK_SIZE = int(32 * 1e6)


@pytest.fixture
def get_test_message(default_project):
    """
    creates a test message to be inserted in a kafka queue
    """

    def inner(type, project=default_project):
        now = datetime.datetime.now()
        # the event id should be 32 digits
        event_id = uuid.uuid4().hex
        message_text = f"some message {event_id}"
        project_id = project.id  # must match the project id set up by the test fixtures
        if type == "transaction":
            event = {
                "type": "transaction",
                "timestamp": now.isoformat(),
                "start_timestamp": now.isoformat(),
                "event_id": event_id,
                "spans": [],
                "contexts": {
                    "trace": {
                        "parent_span_id": "8988cec7cc0779c1",
                        "type": "trace",
                        "op": "foobar",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                        "span_id": "babaae0d4b7512d9",
                        "status": "ok",
                    }
                },
            }
        elif type == "event":
            event = {"message": message_text, "extra": {"the_id": event_id}, "event_id": event_id}
        else:
            raise ValueError(type)

        em = EventManager(event, project=project)
        em.normalize()
        normalized_event = dict(em.get_data())
        message = {
            "type": "event",
            "start_time": time.time(),
            "event_id": event_id,
            "project_id": int(project_id),
            "payload": json.dumps(normalized_event),
        }

        val = msgpack.packb(message)
        return val, event_id

    return inner


@pytest.fixture
def random_group_id():
    return f"test-consumer-{random.randint(0, 2 ** 16)}"


@django_db_all(transaction=True)
def test_ingest_consumer_reads_from_topic_and_calls_celery_task(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    get_test_message,
    random_group_id,
):
    topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_event_name])

    message, event_id = get_test_message(type="event")
    producer.produce(topic_event_name, message)

    transaction_message, transaction_event_id = get_test_message(type="transaction")
    producer.produce(topic_event_name, transaction_message)

    consumer = get_ingest_consumer(
        consumer_type=ConsumerType.Events,
        group_id=random_group_id,
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        max_batch_size=2,
        max_batch_time=5,
        num_processes=10,
        input_block_size=DEFAULT_BLOCK_SIZE,
        output_block_size=DEFAULT_BLOCK_SIZE,
        force_cluster=None,
        force_topic=None,
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            transaction_message = eventstore.backend.get_event_by_id(
                default_project.id, transaction_event_id
            )
            message = eventstore.backend.get_event_by_id(default_project.id, event_id)

            if transaction_message and message:
                break

            consumer._run_once()
            i += 1

    # check that we got the messages
    assert message.data["event_id"] == event_id
    assert message.data["extra"]["the_id"] == event_id

    assert transaction_message.data["event_id"] == transaction_event_id
    assert transaction_message.data["spans"] == []
    assert transaction_message.data["contexts"]["trace"]


@django_db_all(transaction=True)
def test_ingest_topic_can_be_overridden(
    task_runner,
    kafka_admin,
    random_group_id,
    default_project,
    get_test_message,
    kafka_producer,
):
    """
    Tests that 'force_topic' overrides the value provided in settings
    """
    default_event_topic = ConsumerType.get_topic_name(ConsumerType.Events)
    new_event_topic = default_event_topic + "-new"

    admin = kafka_admin(settings)
    admin.delete_topic(default_event_topic)
    admin.delete_topic(new_event_topic)
    create_topics("default", [new_event_topic])

    producer = kafka_producer(settings)
    message, event_id = get_test_message(type="event")
    producer.produce(new_event_topic, message)

    consumer = get_ingest_consumer(
        consumer_type=ConsumerType.Events,
        group_id=random_group_id,
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        max_batch_size=2,
        max_batch_time=5,
        num_processes=1,
        input_block_size=DEFAULT_BLOCK_SIZE,
        output_block_size=DEFAULT_BLOCK_SIZE,
        force_topic=new_event_topic,
        force_cluster="default",
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            message = eventstore.backend.get_event_by_id(default_project.id, event_id)

            if message:
                break

            consumer._run_once()
            i += 1

    # Check that we got the message
    assert message.data["event_id"] == event_id
    assert message.data["extra"]["the_id"] == event_id

    # Check that the default topic was not created
    all_topics = admin.admin_client.list_topics().topics.keys()
    assert new_event_topic in all_topics
    assert default_event_topic not in all_topics
