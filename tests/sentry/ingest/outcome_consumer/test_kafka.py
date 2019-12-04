from __future__ import absolute_import

import logging
import pytest
import six.moves

from sentry.ingest.outcomes_consumer import get_outcomes_consumer, mark_signal_sent, is_signal_sent
from sentry.signals import event_filtered, event_dropped
from sentry.testutils.factories import Factories
from sentry.utils.outcomes import Outcome, _get_tsdb_cache_key, mark_tsdb_incremented_many
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from sentry.utils import json
from sentry import tsdb

logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


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
    timestamp=None,
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
    if timestamp is not None:
        message["timestamp"] = timestamp

    msg = json.dumps(message)
    return msg


def _get_outcome_topic_name():
    return settings.KAFKA_OUTCOMES


def _setup_outcome_test(kafka_producer, kafka_admin):
    topic_name = _get_outcome_topic_name()
    organization = Factories.create_organization()
    project = Factories.create_project(organization=organization)
    project_id = project.id
    producer = kafka_producer(settings)
    admin = kafka_admin(settings)
    admin.delete_topic(topic_name)
    return producer, project_id, topic_name


@pytest.mark.django_db
def test_outcome_consumer_ignores_outcomes_already_handled(
    kafka_producer, task_runner, kafka_admin, requires_kafka
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    group_id = "test-outcome-consumer-1"
    last_event_id = None

    # put a few outcome messages on the kafka topic and also mark them in the cache
    for i in range(4):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )
        if i in (0, 1):
            # pretend that we have already processed this outcome before
            mark_signal_sent(project_id=project_id, event_id=_get_event_id(i))
        else:
            # Last event is used to check when the outcome producer is done
            last_event_id = _get_event_id(i)
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

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    # run the outcome consumer
    with task_runner():
        i = 0
        while (
            not is_signal_sent(project_id=project_id, event_id=last_event_id)
            and i < MAX_POLL_ITERATIONS
        ):
            consumer._run_once()
            i += 1

    assert is_signal_sent(project_id=project_id, event_id=last_event_id)

    # verify that no signal was called (since the events have been previously processed)
    assert event_filtered_sink == ["127.33.44.2", "127.33.44.3"]
    assert len(event_dropped_sink) == 0


@pytest.mark.django_db
def test_outcome_consumer_ignores_invalid_outcomes(
    kafka_producer, task_runner, kafka_admin, requires_kafka
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    group_id = "test-outcome-consumer-2"

    # put a few outcome messages on the kafka topic. Add two FILTERED items so
    # we know when the producer has reached the end
    for i in range(4):
        msg = _get_outcome(
            event_id=i,
            project_id=project_id,
            outcome=Outcome.INVALID if i < 2 else Outcome.FILTERED,
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

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    # run the outcome consumer
    with task_runner():
        i = 0
        while len(event_filtered_sink) < 2 and i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            i += 1

    # verify that the appropriate filters were called
    assert event_filtered_sink == ["127.33.44.2", "127.33.44.3"]
    assert len(event_dropped_sink) == 0


@pytest.mark.django_db
def test_outcome_consumer_remembers_handled_outcomes(
    kafka_producer, task_runner, kafka_admin, requires_kafka
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    group_id = "test-outcome-consumer-3"

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

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    # run the outcome consumer
    with task_runner():
        i = 0
        while not event_filtered_sink and i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            i += 1

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 1
    assert event_filtered_sink == ["127.33.44.1"]
    assert len(event_dropped_sink) == 0


@pytest.mark.django_db
def test_outcome_consumer_handles_filtered_outcomes(
    kafka_producer, task_runner, kafka_admin, requires_kafka
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    group_id = "test-outcome-consumer-4"

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

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    # run the outcome consumer
    with task_runner():
        i = 0
        while len(event_filtered_sink) < 2 and i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            i += 1

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 2
    assert set(event_filtered_sink) == set(["127.33.44.1", "127.33.44.2"])
    assert len(event_dropped_sink) == 0


@pytest.mark.django_db
def test_outcome_consumer_handles_rate_limited_outcomes(
    kafka_producer, task_runner, kafka_admin, requires_kafka
):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    group_id = "test-outcome-consumer-5"

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

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    # run the outcome consumer
    with task_runner():
        i = 0
        while len(event_dropped_sink) < 2 and i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            i += 1

    # verify that the appropriate filters were called
    assert len(event_filtered_sink) == 0
    assert len(event_dropped_sink) == 2
    assert set(event_dropped_sink) == set(
        [("127.33.44.1", "reason_1"), ("127.33.44.2", "reason_2")]
    )


@pytest.mark.django_db
def test_tsdb(kafka_producer, task_runner, kafka_admin, requires_kafka, monkeypatch):
    producer, project_id, topic_name = _setup_outcome_test(kafka_producer, kafka_admin)

    timestamps = []

    for i in range(2):
        timestamp = timezone.now()
        timestamps.append(timestamp)
        producer.produce(
            topic_name,
            _get_outcome(
                event_id=i,
                project_id=project_id,
                outcome=Outcome.RATE_LIMITED,
                reason="go_away",
                remote_addr="127.0.0.1",
                timestamp=timestamp,
            ),
        )

    # Mark first item as already processed
    mark_tsdb_incremented_many([(project_id, _get_event_id(0))])
    assert cache.get(_get_tsdb_cache_key(project_id, _get_event_id(0))) is not None
    assert cache.get(_get_tsdb_cache_key(project_id, _get_event_id(1))) is None

    tsdb_increments = []
    monkeypatch.setattr("sentry.tsdb.incr_multi", tsdb_increments.append)

    group_id = "test-outcome-consumer-6"

    consumer = get_outcomes_consumer(
        max_batch_size=1, max_batch_time=100, group_id=group_id, auto_offset_reset="earliest"
    )

    i = 0

    while not tsdb_increments and i < MAX_POLL_ITERATIONS:
        consumer._run_once()
        i += 1

    assert tsdb_increments == [
        [
            (tsdb.models.project_total_received, project_id, {"timestamp": timestamps[1]}),
            (tsdb.models.project_total_rejected, project_id, {"timestamp": timestamps[1]}),
        ]
    ]

    assert cache.get(_get_tsdb_cache_key(project_id, _get_event_id(0))) is not None
    assert cache.get(_get_tsdb_cache_key(project_id, _get_event_id(1))) is not None
