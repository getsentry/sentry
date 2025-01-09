import logging
import random
import time
import uuid

import msgpack
import orjson
import pytest
from django.conf import settings

from sentry import eventstore
from sentry.conf.types.kafka_definition import Topic
from sentry.consumers import get_stream_processor
from sentry.event_manager import EventManager
from sentry.eventstore.processing import event_processing_store
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.kafka_config import get_topic_definition

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
        # the event id should be 32 digits
        event_id = uuid.uuid4().hex
        message_text = f"some message {event_id}"
        project_id = project.id  # must match the project id set up by the test fixtures
        if type == "event":
            event = {
                "message": message_text,
                "extra": {"the_id": event_id},
                "project": project_id,
                "event_id": event_id,
            }
        else:
            raise AssertionError(type)

        em = EventManager(event, project=project)
        em.normalize()
        normalized_event = dict(em.get_data())
        message = {
            "type": "event",
            "start_time": int(time.time()),
            "event_id": event_id,
            "project_id": int(project_id),
            "payload": orjson.dumps(normalized_event),
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

    topic = Topic.INGEST_EVENTS
    topic_event_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_event_name])

    message, event_id = get_test_message(type="event")
    producer.produce(topic_event_name, message)

    consumer = get_stream_processor(
        "ingest-events",
        consumer_args=["--max-batch-size=2", "--max-batch-time-ms=5000", "--processes=10"],
        topic=None,
        cluster=None,
        group_id=random_group_id,
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        enforce_schema=True,
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            message = eventstore.backend.get_event_by_id(default_project.id, event_id)

            if message:
                break

            consumer._run_once()
            i += 1

    # check that we got the messages
    assert message.data["event_id"] == event_id
    assert message.data["extra"]["the_id"] == event_id


@django_db_all(transaction=True)
def test_ingest_consumer_gets_event_unstuck(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    get_test_message,
    random_group_id,
):
    topic = Topic.INGEST_EVENTS
    topic_event_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_event_name])

    message1, event_id1 = get_test_message(type="event")
    producer.produce(topic_event_name, message1)

    message2, event_id2 = get_test_message(type="event")
    producer.produce(topic_event_name, message2)

    # an event is "stuck" when it is in the processing store, so lets fake that:
    event_processing_store.store({"project": default_project.id, "event_id": event_id2})

    consumer = get_stream_processor(
        "ingest-events",
        consumer_args=[
            "--max-batch-size=2",
            "--max-batch-time-ms=5000",
            "--processes=10",
            "--reprocess-only-stuck-events",
        ],
        topic=None,
        cluster=None,
        group_id=random_group_id,
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        enforce_schema=True,
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            message = eventstore.backend.get_event_by_id(default_project.id, event_id2)

            if message:
                break

            consumer._run_once()
            i += 1

    # check that we got the messages
    assert message is not None
    assert message.data["event_id"] == event_id2
    assert message.data["extra"]["the_id"] == event_id2

    # the first event was never "stuck", so we expect it to be skipped
    assert not eventstore.backend.get_event_by_id(default_project.id, event_id1)
