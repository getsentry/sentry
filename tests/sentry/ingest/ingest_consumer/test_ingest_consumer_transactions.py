import datetime
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
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.kafka_config import get_topic_definition

pytestmark = [requires_snuba, requires_kafka]

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


def get_test_message(project):
    """
    creates a test message to be inserted in a kafka queue
    """

    now = datetime.datetime.now()
    # the event id should be 32 digits
    event_id = uuid.uuid4().hex
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

    em = EventManager(event, project=project)
    em.normalize()
    normalized_event = dict(em.get_data())
    message = {
        "type": "event",
        "start_time": int(time.time()),
        "event_id": event_id,
        "project_id": int(project.id),
        "payload": orjson.dumps(normalized_event),
    }

    val = msgpack.packb(message)
    return val, event_id


@pytest.fixture
def random_group_id():
    return f"test-consumer-{random.randint(0, 2 ** 16)}"


@django_db_all(transaction=True)
def test_ingest_consumer_reads_from_topic_and_calls_celery_task(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    random_group_id,
):
    """
    Tests the no-celery-mode variant of ingest transactions consumer
    """
    topic = Topic.INGEST_TRANSACTIONS
    topic_event_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_event_name])

    message, event_id = get_test_message(project=default_project)
    producer.produce(topic_event_name, message)

    consumer = get_stream_processor(
        "ingest-transactions",
        consumer_args=[
            "--max-batch-size=2",
            "--max-batch-time-ms=5000",
            "--processes=10",
            "--no-celery-mode",
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
            transaction_message = eventstore.backend.get_event_by_id(default_project.id, event_id)

            if transaction_message:
                break

            consumer._run_once()
            i += 1

    # check that we got the messages
    assert transaction_message.data["event_id"] == event_id
    assert transaction_message.data["spans"] == []
    assert transaction_message.data["contexts"]["trace"]
