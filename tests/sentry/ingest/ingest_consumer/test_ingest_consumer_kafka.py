from __future__ import absolute_import

import datetime
import time
import logging
import msgpack
import pytest

from django.conf import settings

from sentry import eventstore, options
from sentry.event_manager import EventManager
from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer
from sentry.utils import json

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


@pytest.fixture(params=["transaction", "event"])
def get_test_message(request, default_project):
    """
    creates a test message to be inserted in a kafka queue
    """

    def inner(project=default_project):
        now = datetime.datetime.now()
        # the event id should be 32 digits
        event_id = "{}".format(now.strftime("000000000000%Y%m%d%H%M%S%f"))
        message_text = "some message {}".format(event_id)
        project_id = project.id  # must match the project id set up by the test fixtures
        if request.param == "transaction":
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
        elif request.param == "event":
            event = {"message": message_text, "extra": {"the_id": event_id}, "event_id": event_id}

        em = EventManager(event, project=project)
        em.normalize()
        normalized_event = dict(em.get_data())
        message = {
            "type": request.param,
            "start_time": time.time(),
            "event_id": event_id,
            "project_id": int(project_id),
            "payload": json.dumps(normalized_event),
        }

        val = msgpack.packb(message)
        return val, event_id

    return inner


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "inline_transactions", [True, False], ids=["inline_transactions", "worker_transactions"]
)
def test_ingest_consumer_reads_from_topic_and_calls_celery_task(
    task_runner,
    kafka_producer,
    kafka_admin,
    requires_kafka,
    default_project,
    get_test_message,
    inline_transactions,
):
    group_id = "test-consumer"
    topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    event_ids = set()
    for _ in range(3):
        message, event_id = get_test_message()
        producer.produce(topic_event_name, message)
        event_ids.add(event_id)

    consumer = get_ingest_consumer(
        max_batch_size=2,
        max_batch_time=5000,
        group_id=group_id,
        consumer_type=ConsumerType.Events,
        auto_offset_reset="earliest",
    )

    options.set("store.transactions-celery", not inline_transactions)
    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            if eventstore.get_event_by_id(default_project.id, event_id):
                break

            consumer._run_once()
            i += 1

    # check that we got the messages
    for event_id in event_ids:
        message = eventstore.get_event_by_id(default_project.id, event_id)
        assert message is not None
        assert message.data["event_id"] == event_id
        if message.data["type"] == "transaction":
            assert message.data["spans"] == []
            assert message.data["contexts"]["trace"]
        else:
            assert message.data["extra"]["the_id"] == event_id
