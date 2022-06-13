import datetime
import logging
import random
import time
from concurrent.futures.thread import ThreadPoolExecutor

import msgpack
import pytest
from confluent_kafka import KafkaError
from django.conf import settings
from django.test import override_settings

from sentry import eventstore
from sentry.event_manager import EventManager
from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer
from sentry.utils import json

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


@pytest.fixture
def get_test_message(default_project):
    """
    creates a test message to be inserted in a kafka queue
    """

    def inner(type, project=default_project):
        now = datetime.datetime.now()
        # the event id should be 32 digits
        event_id = "{}".format(now.strftime("000000000000%Y%m%d%H%M%S%f"))
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


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "executor",
    [pytest.param(None, id="synchronous"), pytest.param(ThreadPoolExecutor(), id="asynchronous")],
)
def test_ingest_consumer_reads_from_topic_and_calls_celery_task(
    executor,
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

    message, event_id = get_test_message(type="event")
    producer.produce(topic_event_name, message)

    transaction_message, transaction_event_id = get_test_message(type="transaction")
    producer.produce(topic_event_name, transaction_message)

    with override_settings(KAFKA_CONSUMER_AUTO_CREATE_TOPICS=True):
        consumer = get_ingest_consumer(
            max_batch_size=2,
            max_batch_time=5000,
            group_id=random_group_id,
            consumer_types={ConsumerType.Events},
            auto_offset_reset="earliest",
            executor=executor,
        )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            transaction_message = eventstore.get_event_by_id(
                default_project.id, transaction_event_id
            )
            message = eventstore.get_event_by_id(default_project.id, event_id)

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


def test_ingest_consumer_fails_when_not_autocreating_topics(kafka_admin, random_group_id):
    topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)

    with override_settings(KAFKA_CONSUMER_AUTO_CREATE_TOPICS=False):
        consumer = get_ingest_consumer(
            max_batch_size=2,
            max_batch_time=5000,
            group_id=random_group_id,
            consumer_types={ConsumerType.Events},
            auto_offset_reset="earliest",
        )

    with pytest.raises(Exception) as err:
        consumer._run_once()

    kafka_error = err.value.args[0]
    assert kafka_error.code() == KafkaError.UNKNOWN_TOPIC_OR_PART


@pytest.mark.django_db(transaction=True)
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

    producer = kafka_producer(settings)
    message, event_id = get_test_message(type="event")
    producer.produce(new_event_topic, message)

    with override_settings(KAFKA_CONSUMER_AUTO_CREATE_TOPICS=True):
        consumer = get_ingest_consumer(
            max_batch_size=2,
            max_batch_time=5000,
            group_id=random_group_id,
            consumer_types={ConsumerType.Events},
            auto_offset_reset="earliest",
            force_topic=new_event_topic,
            force_cluster="default",
        )

    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            message = eventstore.get_event_by_id(default_project.id, event_id)

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
