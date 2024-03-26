import datetime
import logging
import random
import uuid
from unittest.mock import Mock

import msgpack
import pytest
from confluent_kafka import Consumer as ConfluentConsumer
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.consumers import get_stream_processor
from sentry.eventstore.processing import event_processing_store
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.kafka_config import get_topic_definition

from .test_utils import make_ingest_message

"""
Based on test_ingest_consumer_kafka.py.
Runs end-to-end tests on Kafka -> ingest-feedback-events consumer -> DLQ
"""

pytestmark = [requires_snuba, requires_kafka]

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100
POLL_DURATION_S = 0.1

# Block size for shared memory of the multiprocessing kafka consumer strategy.
# Any reasonable value will do for tests.
DEFAULT_BLOCK_SIZE = int(32 * 1e6)


@pytest.fixture
def get_feedback_message(default_project):
    def inner(project=default_project):
        now = datetime.datetime.now()
        # the event id should be 32 digits
        event_id = uuid.uuid4().hex
        event = {
            "event_id": event_id,
            "type": "feedback",
            "timestamp": now.isoformat(),
            "start_timestamp": now.isoformat(),
            "spans": [],
            "contexts": {
                "feedback": {
                    "contact_email": "test_test.com",
                    "message": "I really like this user-feedback feature!",
                    "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                    "url": "https://docs.sentry.io/platforms/javascript/",
                    "name": "Colton Allen",
                    "type": "feedback",
                },
            },
        }
        message, _ = make_ingest_message(event, project, normalize=True)
        val = msgpack.packb(message)
        return val, event_id

    return inner


def get_random_group_id():
    return f"test-consumer-{random.randint(0, 2 ** 16)}"


@pytest.fixture
def create_feedback_issue(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.create_feedback_issue", mock)
    return mock


@django_db_all(transaction=True)
def test_consumer_reads_from_topic_and_creates_feedback_issue(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    get_feedback_message,
    create_feedback_issue,
    monkeypatch,
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    topic = Topic.INGEST_FEEDBACK_EVENTS
    topic_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_name])

    message, event_id = get_feedback_message()
    producer.produce(topic_name, message)

    consumer = get_stream_processor(
        "ingest-feedback-events",
        consumer_args=["--max-batch-size=2", "--max-batch-time-ms=5000", "--processes=10"],
        topic=None,  # topic and cluster inferred from consumer defn
        cluster=None,
        group_id=get_random_group_id(),
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        enforce_schema=True,
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS and not create_feedback_issue.call_count:
            consumer._run_once()
            i += 1

    assert create_feedback_issue.call_count == 1
    assert create_feedback_issue.call_args[0][0]["event_id"] == event_id
    assert create_feedback_issue.call_args[0][0]["type"] == "feedback"
    assert create_feedback_issue.call_args[0][0].get("contexts", {}).get("feedback") is not None
    assert create_feedback_issue.call_args[0][1] == default_project.id


@django_db_all(transaction=True)
def test_consumer_gets_event_unstuck_and_reprocess_only_stuck_events(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    get_feedback_message,
    create_feedback_issue,
    monkeypatch,
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    topic = Topic.INGEST_FEEDBACK_EVENTS
    topic_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_name])

    message1, event_id1 = get_feedback_message()
    producer.produce(topic_name, message1)

    message2, event_id2 = get_feedback_message()
    producer.produce(topic_name, message2)

    # an event is "stuck" when it is in the processing store, so lets fake that:
    event_processing_store.store({"project": default_project.id, "event_id": event_id2})

    consumer = get_stream_processor(
        "ingest-feedback-events",
        consumer_args=[
            "--max-batch-size=2",
            "--max-batch-time-ms=5000",
            "--processes=10",
            "--reprocess-only-stuck-events",
        ],
        topic=None,  # topic and cluster inferred from consumer defn
        cluster=None,
        group_id=get_random_group_id(),
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        enforce_schema=True,
    )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS and not create_feedback_issue.call_count:
            consumer._run_once()
            i += 1

    # check that we called create_feedback_issue with the right event.
    # the first event was never "stuck", so we expect it to be skipped
    assert create_feedback_issue.call_count == 1
    assert create_feedback_issue.call_args[0][0]["event_id"] == event_id2
    assert create_feedback_issue.call_args[0][0]["type"] == "feedback"
    assert create_feedback_issue.call_args[0][0].get("contexts", {}).get("feedback") is not None
    assert create_feedback_issue.call_args[0][1] == default_project.id


@django_db_all(transaction=True)
def test_consumer_writes_to_dlq(
    task_runner,
    kafka_producer,
    kafka_admin,
):
    topic = Topic.INGEST_FEEDBACK_EVENTS
    topic_name = get_topic_definition(topic)["real_topic_name"]
    dlq_topic = Topic.INGEST_FEEDBACK_EVENTS_DLQ
    dlq_topic_name = get_topic_definition(dlq_topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_name)
    admin.delete_topic(dlq_topic_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_name, dlq_topic_name])

    invalid_msg = b"bad message :("
    producer.produce(topic_name, invalid_msg)

    consumer = get_stream_processor(
        "ingest-feedback-events",
        consumer_args=["--max-batch-size=2", "--max-batch-time-ms=5000", "--processes=10"],
        topic=None,  # topic and cluster inferred from consumer defn
        cluster=None,
        group_id=get_random_group_id(),
        auto_offset_reset="earliest",
        strict_offset_reset=False,
        enforce_schema=False,
        enable_dlq=True,
    )

    dlq_consumer = ConfluentConsumer(
        {
            "bootstrap.servers": "127.0.0.1:9092",
            "log_level": 6,
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": get_random_group_id(),
            "auto.offset.reset": "earliest",
            "enable.partition.eof": False,
        }
    )
    dlq_consumer.subscribe([dlq_topic_name])

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            message = dlq_consumer.poll(timeout=POLL_DURATION_S)
            if message is not None:
                if (err := message.error()) is not None:
                    raise err
                assert message.value() == invalid_msg
                break
            i += 1
