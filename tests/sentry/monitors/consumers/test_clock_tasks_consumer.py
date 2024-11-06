from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MonitorsClockTasks

from sentry.monitors.consumers.clock_tasks_consumer import (
    MONITORS_CLOCK_TASKS_CODEC,
    MonitorClockTasksStrategyFactory,
)

partition = Partition(Topic("test"), 0)


def create_consumer() -> ProcessingStrategy[KafkaPayload]:
    factory = MonitorClockTasksStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


def send_task(
    consumer: ProcessingStrategy[KafkaPayload],
    ts: datetime,
    task: MonitorsClockTasks,
):
    value = BrokerValue(
        KafkaPayload(b"fake-key", MONITORS_CLOCK_TASKS_CODEC.encode(task), []),
        partition,
        1,
        ts,
    )
    consumer.submit(Message(value))


@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_environment_missing")
def test_dispatch_mark_missing(mock_mark_environment_missing):
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer()
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 1},
    )

    assert mock_mark_environment_missing.call_count == 1
    assert mock_mark_environment_missing.mock_calls[0] == mock.call(1, ts)


@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_checkin_timeout")
def test_dispatch_mark_timeout(mock_mark_checkin_timeout):
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer()
    send_task(
        consumer,
        ts,
        {
            "type": "mark_timeout",
            "ts": ts.timestamp(),
            "monitor_environment_id": 1,
            "checkin_id": 1,
        },
    )

    assert mock_mark_checkin_timeout.call_count == 1
    assert mock_mark_checkin_timeout.mock_calls[0] == mock.call(1, ts)


@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_checkin_unknown")
def test_dispatch_mark_unknown(mock_mark_checkin_unknown):
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer()
    send_task(
        consumer,
        ts,
        {
            "type": "mark_unknown",
            "ts": ts.timestamp(),
            "monitor_environment_id": 1,
            "checkin_id": 1,
        },
    )

    assert mock_mark_checkin_unknown.call_count == 1
    assert mock_mark_checkin_unknown.mock_calls[0] == mock.call(1, ts)
