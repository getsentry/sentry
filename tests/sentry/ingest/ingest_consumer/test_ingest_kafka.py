from __future__ import absolute_import

import datetime
import time
import logging
import msgpack
import pytest

from django.conf import settings

from sentry.event_manager import EventManager
from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer
from sentry.models.event import Event
from sentry.utils import json
from sentry.testutils.factories import Factories

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


def _get_test_message(project):
    """
    creates a test message to be inserted in a kafka queue
    """
    now = datetime.datetime.now()
    # the event id should be 32 digits
    event_id = "{}".format(now.strftime("000000000000%Y%m%d%H%M%S%f"))
    message_text = "some message {}".format(event_id)
    project_id = project.id  # must match the project id set up by the test fixtures
    event = {
        "message": message_text,
        "extra": {"the_id": event_id},
        "project_id": project_id,
        "event_id": event_id,
    }

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


def _shutdown_requested(max_secs, num_events):
    """
    Requests a shutdown after the specified interval has passed or the specified number
    of events are detected
    :param max_secs: number of seconds after which to request a shutdown
    :param num_events: number of events after which to request a shutdown
    :return: True if a shutdown is requested False otherwise
    """

    def inner():
        end_time = time.time()
        if end_time - start_time > max_secs:
            logger.debug("Shutdown requested because max secs exceeded")
            return True
        elif Event.objects.count() >= num_events:
            logger.debug("Shutdown requested because num events reached")
            return True
        else:
            return False

    start_time = time.time()
    return inner


@pytest.mark.django_db
def test_ingest_consumer_reads_from_topic_and_calls_celery_task(
    task_runner, kafka_producer, kafka_admin, requires_kafka
):
    group_id = "test-consumer"
    topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)

    admin = kafka_admin(settings)
    admin.delete_topic(topic_event_name)
    producer = kafka_producer(settings)

    organization = Factories.create_organization()
    project = Factories.create_project(organization=organization)

    event_ids = set()
    for _ in range(3):
        message, event_id = _get_test_message(project)
        event_ids.add(event_id)
        producer.produce(topic_event_name, message)

    consumer = get_ingest_consumer(
        max_batch_size=2,
        max_batch_time=5000,
        group_id=group_id,
        consumer_type=ConsumerType.Events,
        auto_offset_reset="earliest",
    )

    with task_runner():
        i = 0
        while Event.objects.count() < 3 and i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            i += 1

    # check that we got the messages
    assert Event.objects.count() == 3
    for event_id in event_ids:
        message = Event.objects.get(event_id=event_id)
        assert message is not None
        # check that the data has not been scrambled
        assert message.data["extra"]["the_id"] == event_id
