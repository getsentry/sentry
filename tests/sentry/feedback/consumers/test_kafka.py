import datetime
import logging
import random
import time
import uuid
from unittest.mock import Mock

import msgpack
import pytest
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.consumers import get_stream_processor
from sentry.event_manager import EventManager
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_kafka, requires_snuba
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.kafka_config import get_topic_definition

"""
Based on test_ingest_consumer_kafka.py.
Runs end-to-end tests on Kafka -> ingest-feedback-events consumer -> DLQ
"""

pytestmark = [requires_snuba, requires_kafka]

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100

# Block size for shared memory of the multiprocessing kafka consumer strategy.
# Any reasonable value will do for tests.
DEFAULT_BLOCK_SIZE = int(32 * 1e6)


@pytest.fixture
def get_test_feedback_event(default_project):
    def inner(project=default_project):
        now = datetime.datetime.now()
        # the event id should be 32 digits
        event_id = uuid.uuid4().hex
        project_id = project.id  # must match the project id set up by the test fixtures
        event = {
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
        em = EventManager(event, project=project)
        em.normalize()
        normalized_event = dict(em.get_data())
        message = {
            "type": "event",
            "start_time": int(time.time()),
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


@pytest.fixture
def create_feedback_issue(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.create_feedback_issue", mock)
    return mock


@django_db_all(transaction=True)
def test_consumer_reads_from_topic_and_calls_create_feedback(
    task_runner,
    kafka_producer,
    kafka_admin,
    default_project,
    get_test_feedback_event,
    random_group_id,
    create_feedback_issue,
    monkeypatch,
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    topic = Topic.INGEST_FEEDBACK_EVENTS
    topic_event_name = get_topic_definition(topic)["real_topic_name"]

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    create_topics("default", [topic_event_name])

    message, event_id = get_test_feedback_event()
    producer.produce(topic_event_name, message)

    consumer = get_stream_processor(
        "ingest-feedback-events",
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
        while i < MAX_POLL_ITERATIONS and not create_feedback_issue.call_count:
            consumer._run_once()
            i += 1

    assert create_feedback_issue.call_count == 1
    assert create_feedback_issue.call_args[0][0].get("contexts", {}).get("feedback")
    assert create_feedback_issue.call_args[0][0]["type"] == "feedback"
    assert create_feedback_issue.call_args[0][1] == default_project.id


# def test_dlq():
#     pass
