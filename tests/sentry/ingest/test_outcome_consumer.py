from __future__ import absolute_import

import logging
import time
import os
import pytest
import six.moves

from sentry.ingest.outcomes_consumer import run_outcomes_consumer, mark_signal_sent
from sentry.signals import event_filtered, event_dropped
from sentry.testutils.factories import Factories
from sentry.utils.outcomes import Outcome
from django.conf import settings
from sentry.utils import json

from .ingest_utils import requires_kafka

logger = logging.getLogger(__name__)

SKIP_CONSUMER_TESTS = os.environ.get("SENTRY_RUN_CONSUMER_TESTS") != "1"


def _get_event_id(base_event_id):
    return "{:032}".format(int(base_event_id))


def _get_outcome(
    event_id=None,
    project_id=None,
    org_id=None,
    key_id=None,
    outcome=None,
    reason=None,
    remote_addr=None,
):
    message = {}
    if event_id is not None:
        event_id = _get_event_id(event_id)
        message["event_id"] = event_id
    if project_id is not None:
        message["project_id"] = project_id
    if org_id is not None:
        message["org_id"] = org_id
    if key_id is not None:
        message["key_id"] = key_id
    if org_id is not None:
        message["org_id"] = org_id
    if outcome is not None:
        message["outcome"] = outcome
    if reason is not None:
        message["reason"] = reason
    if remote_addr is not None:
        message["remote_addr"] = remote_addr

    msg = json.dumps(message)
    return msg


def _get_outcome_topic_name():
    return settings.KAFKA_OUTCOMES


def _shutdown_requested(max_secs, num_outcomes, signal_sink):
    """
    Requests a shutdown after the specified interval has passed or the specified number
    of outcomes are detected

    :param max_secs: number of seconds after which to request a shutdown
    :param num_outcomes: number of events after which to request a shutdown
    :param signal_sink: a list where the signal handler accumulates the outcomes
    :return: True if a shutdown is requested False otherwise
    """

    def inner():
        end_time = time.time()
        if end_time - start_time > max_secs:
            logger.debug("Shutdown requested because max secs exceeded")
            return True
        elif len(signal_sink) >= num_outcomes:
            logger.debug("Shutdown requested because num outcomes reached")
            return True
        else:
            return False

    start_time = time.time()
    return inner


def _setup_outcome_test(kafka_producer, kafka_admin):
    topic_name = _get_outcome_topic_name()
    organization = Factories.create_organization()
    project = Factories.create_project(organization=organization)
    project_id = project.id
    producer = kafka_producer(settings)
    admin = kafka_admin(settings)
    admin.delete_topic(topic_name)
    return producer, project_id, topic_name


@pytest.mark.skipif(
    SKIP_CONSUMER_TESTS, reason="slow test, reading the first kafka message takes many seconds"
)
@pytest.mark.django_db
@requires_kafka
def test_outcome_consumer_ignores_outcomes_already_handled(
    kafka_producer, task_runner, kafka_admin
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    consumer_group = "test-outcome-consumer-1"

    # put a few outcome messages on the kafka topic and also mark them in the cache
    for i in six.moves.range(1, 3):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )
        # pretend that we have already processed this outcome before
        mark_signal_sent(project_id=project_id, event_id=_get_event_id(i))
        # put the outcome on the kafka topic
        producer.produce(topic_name, msg)

    # setup django signals for event_filtered and event_dropped
    event_filtered_sink = []
    event_dropped_sink = []

    def event_filtered_receiver(**kwargs):
        event_filtered_sink.append(kwargs.get("ip"))

    def event_dropped_receiver(**kwargs):
        event_dropped_sink.append("something")

    event_filtered.connect(event_filtered_receiver)
    event_dropped.connect(event_dropped_receiver)

    # run the outcome consumer
    with task_runner():
        run_outcomes_consumer(
            commit_batch_size=2,
            consumer_group=consumer_group,
            max_fetch_time_seconds=0.1,
            initial_offset_reset="earliest",
            is_shutdown_requested=_shutdown_requested(
                max_secs=10, num_outcomes=1, signal_sink=event_filtered_sink
            ),
        )

    # verify that no signal was called (since the events have been previously processed)
    assert len(event_filtered_sink) == 0
    assert len(event_dropped_sink) == 0


@pytest.mark.skipif(
    SKIP_CONSUMER_TESTS, reason="slow test, reading the first kafka message takes many seconds"
)
@pytest.mark.django_db
@requires_kafka
def test_outcome_consumer_ignores_invalid_outcomes(kafka_producer, task_runner, kafka_admin):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    consumer_group = "test-outcome-consumer-2"

    # put a few outcome messages on the kafka topic
    for i in six.moves.range(1, 3):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.INVALID,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )

        producer.produce(topic_name, msg)

    # setup django signals for event_filtered and event_dropped
    event_filtered_sink = []
    event_dropped_sink = []

    def event_filtered_receiver(**kwargs):
        event_filtered_sink.append(kwargs.get("ip"))

    def event_dropped_receiver(**kwargs):
        event_dropped_sink.append("something")

    event_filtered.connect(event_filtered_receiver)
    event_dropped.connect(event_dropped_receiver)

    # run the outcome consumer
    with task_runner():
        run_outcomes_consumer(
            commit_batch_size=2,
            consumer_group=consumer_group,
            max_fetch_time_seconds=0.1,
            initial_offset_reset="earliest",
            is_shutdown_requested=_shutdown_requested(
                max_secs=10, num_outcomes=1, signal_sink=event_filtered_sink
            ),
        )

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 0
    assert len(event_dropped_sink) == 0


@pytest.mark.skipif(
    SKIP_CONSUMER_TESTS, reason="slow test, reading the first kafka message takes many seconds"
)
@pytest.mark.django_db
@requires_kafka
def test_outcome_consumer_remembers_handled_outcomes(kafka_producer, task_runner, kafka_admin):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    consumer_group = "test-outcome-consumer-3"

    # put a few outcome messages on the kafka topic
    for i in six.moves.range(1, 3):
        # emit the same outcome twice ( simulate the case when the  producer goes down without
        # committing the kafka offsets and is restarted)
        msg = _get_outcome(
            event_id=1,
            project_id=project_id,
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(1),
        )

        producer.produce(topic_name, msg)

    # setup django signals for event_filtered and event_dropped
    event_filtered_sink = []
    event_dropped_sink = []

    def event_filtered_receiver(**kwargs):
        event_filtered_sink.append(kwargs.get("ip"))

    def event_dropped_receiver(**kwargs):
        event_dropped_sink.append("something")

    event_filtered.connect(event_filtered_receiver)
    event_dropped.connect(event_dropped_receiver)

    # run the outcome consumer
    with task_runner():
        run_outcomes_consumer(
            commit_batch_size=2,
            consumer_group=consumer_group,
            max_fetch_time_seconds=0.1,
            initial_offset_reset="earliest",
            is_shutdown_requested=_shutdown_requested(
                max_secs=10, num_outcomes=1, signal_sink=event_filtered_sink
            ),
        )

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 1
    assert event_filtered_sink == ["127.33.44.1"]
    assert len(event_dropped_sink) == 0


@pytest.mark.skipif(
    SKIP_CONSUMER_TESTS, reason="slow test, reading the first kafka message takes many seconds"
)
@pytest.mark.django_db
@requires_kafka
def test_outcome_consumer_handles_filtered_outcomes(kafka_producer, task_runner, kafka_admin):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    consumer_group = "test-outcome-consumer-4"

    # put a few outcome messages on the kafka topic
    for i in six.moves.range(1, 3):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )

        producer.produce(topic_name, msg)

    # setup django signals for event_filtered and event_dropped
    event_filtered_sink = []
    event_dropped_sink = []

    def event_filtered_receiver(**kwargs):
        event_filtered_sink.append(kwargs.get("ip"))

    def event_dropped_receiver(**kwargs):
        event_dropped_sink.append("something")

    event_filtered.connect(event_filtered_receiver)
    event_dropped.connect(event_dropped_receiver)

    # run the outcome consumer
    with task_runner():
        run_outcomes_consumer(
            commit_batch_size=2,
            consumer_group=consumer_group,
            max_fetch_time_seconds=0.1,
            initial_offset_reset="earliest",
            is_shutdown_requested=_shutdown_requested(
                max_secs=10, num_outcomes=1, signal_sink=event_filtered_sink
            ),
        )

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 2
    assert event_filtered_sink == ["127.33.44.1", "127.33.44.2"]
    assert len(event_dropped_sink) == 0


@pytest.mark.skipif(
    SKIP_CONSUMER_TESTS, reason="slow test, reading the first kafka message takes many seconds"
)
@pytest.mark.django_db
@requires_kafka
def test_outcome_consumer_handles_rate_limited_outcomes(kafka_producer, task_runner, kafka_admin):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    consumer_group = "test-outcome-consumer-5"

    # put a few outcome messages on the kafka topic
    for i in six.moves.range(1, 3):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.RATE_LIMITED,
            reason="reason_{}".format(i),
            remote_addr="127.33.44.{}".format(i),
        )

        producer.produce(topic_name, msg)

    # setup django signals for event_filtered and event_dropped
    event_filtered_sink = []
    event_dropped_sink = []

    def event_filtered_receiver(**kwargs):
        event_filtered_sink.append("something")

    def event_dropped_receiver(**kwargs):
        event_dropped_sink.append((kwargs.get("ip"), kwargs.get("reason_code")))

    event_filtered.connect(event_filtered_receiver)
    event_dropped.connect(event_dropped_receiver)

    # run the outcome consumer
    with task_runner():
        run_outcomes_consumer(
            commit_batch_size=2,
            consumer_group=consumer_group,
            max_fetch_time_seconds=0.1,
            initial_offset_reset="earliest",
            is_shutdown_requested=_shutdown_requested(
                max_secs=10, num_outcomes=1, signal_sink=event_filtered_sink
            ),
        )

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 0
    assert len(event_dropped_sink) == 2
    assert event_dropped_sink == [("127.33.44.1", "reason_1"), ("127.33.44.2", "reason_2")]
