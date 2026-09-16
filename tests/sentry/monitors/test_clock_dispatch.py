from collections.abc import Generator
from datetime import datetime, timedelta
from unittest import mock

import pytest
from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.conf import settings
from django.test.utils import override_settings
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tick_v1 import ClockTick

from sentry.monitors.clock_dispatch import (
    MONITOR_TASKS_LAST_TRIGGERED_KEY,
    MONITOR_TASKS_PARTITION_CLOCKS,
    PartitionSetState,
    _dispatch_tick,
    record_pulse_partitions,
    try_monitor_clock_tick,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import json, redis


@pytest.fixture(autouse=True)
def partition_set_state() -> Generator[PartitionSetState]:
    # Each test starts as a process that has not seen a clock pulse
    state = PartitionSetState()
    with mock.patch("sentry.monitors.clock_dispatch._partition_set_state", state):
        yield state


def seed_pulse(partition_count: int) -> None:
    record_pulse_partitions(
        {"message_type": "clock_pulse", "partition_ids": list(range(partition_count))}
    )


def gauge_values(metrics_mock: mock.MagicMock, key: str) -> list[float]:
    return [call.args[1] for call in metrics_mock.gauge.call_args_list if call.args[0] == key]


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger(dispatch_tick: mock.MagicMock) -> None:
    seed_pulse(1)
    now = timezone.now().replace(second=0, microsecond=0)

    # Assumes a single partition for simplicitly. Multi-partition cases are
    # covered in further test cases.

    # First checkin triggers dispatch
    try_monitor_clock_tick(ts=now, partition=0)
    assert dispatch_tick.call_count == 1

    # 5 seconds later does NOT trigger the dispatch
    try_monitor_clock_tick(ts=now + timedelta(seconds=5), partition=0)
    assert dispatch_tick.call_count == 1

    # a minute later DOES trigger the dispatch
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tick.call_count == 2

    # Same time does NOT trigger the dispatch
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tick.call_count == 2

    # A skipped minute triggers the dispatch multiple times
    try_monitor_clock_tick(ts=now + timedelta(minutes=3, seconds=5), partition=0)
    assert dispatch_tick.call_count == 4


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_partition_desync(dispatch_tick: mock.MagicMock) -> None:
    """
    When consumer partitions are not completely synchronized we may read
    timestamps in a non-monotonic order. In this scenario we want to make
    sure we still only trigger once
    """
    seed_pulse(2)
    now = timezone.now().replace(second=0, microsecond=0)

    # First message in partition 0 with timestamp just after the minute
    # boundary triggers the dispatch
    try_monitor_clock_tick(ts=now + timedelta(seconds=1), partition=0)
    assert dispatch_tick.call_count == 1

    # Second message in a partition 1 has a timestamp just before the minute
    # boundary, should not trigger anything since we've already ticked ahead of
    # this
    try_monitor_clock_tick(ts=now - timedelta(seconds=1), partition=1)
    assert dispatch_tick.call_count == 1

    # Third message in partition 1 again just after the minute boundary does
    # NOT trigger the dispatch, we've already ticked at that time.
    try_monitor_clock_tick(ts=now + timedelta(seconds=1), partition=1)
    assert dispatch_tick.call_count == 1

    # Next two messages in both partitions move the clock forward
    try_monitor_clock_tick(ts=now + timedelta(minutes=1, seconds=1), partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1, seconds=1), partition=1)
    assert dispatch_tick.call_count == 2


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_partition_sync(dispatch_tick: mock.MagicMock) -> None:
    """
    When the kafka topic has multiple partitions we want to only tick our clock
    forward once all partitions have caught up. This test simulates that
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_clock_tick(ts=now, partition=0)
    try_monitor_clock_tick(ts=now, partition=1)
    try_monitor_clock_tick(ts=now, partition=2)
    try_monitor_clock_tick(ts=now, partition=3)
    assert dispatch_tick.call_count == 1
    assert dispatch_tick.mock_calls[0] == mock.call(now)

    # Tick forward 3 of the partitions, global clock does not tick
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=2)
    assert dispatch_tick.call_count == 1

    # Slowest partition ticks forward, global clock ticks
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=3)
    assert dispatch_tick.call_count == 2
    assert dispatch_tick.mock_calls[1] == mock.call(now + timedelta(minutes=1))


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_partition_tick_skip(dispatch_tick: mock.MagicMock) -> None:
    """
    In a scenario where all partitions move multiple ticks past the slowest
    partition we may end up skipping a tick. In this scenario we will backfill
    those ticks
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_clock_tick(ts=now, partition=0)
    try_monitor_clock_tick(ts=now, partition=1)
    try_monitor_clock_tick(ts=now, partition=2)
    try_monitor_clock_tick(ts=now, partition=3)
    assert dispatch_tick.call_count == 1
    assert dispatch_tick.mock_calls[0] == mock.call(now)

    # Tick forward twice for 3 partitions
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=2)

    try_monitor_clock_tick(ts=now + timedelta(minutes=2), partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=3), partition=1)
    try_monitor_clock_tick(ts=now + timedelta(minutes=3), partition=2)
    assert dispatch_tick.call_count == 1

    # Slowest partition catches up, but has a timestamp gap
    try_monitor_clock_tick(ts=now + timedelta(minutes=2), partition=3)

    assert dispatch_tick.call_count == 3
    assert dispatch_tick.mock_calls[1] == mock.call(now + timedelta(minutes=1))
    assert dispatch_tick.mock_calls[2] == mock.call(now + timedelta(minutes=2))


def run_short_partition_set_sequence(now: datetime) -> None:
    """
    Partitions 0 to 2 move forward for three minutes while partition 3 is
    missing from the partition clock set, then partition 3 arrives.
    """
    for minute in range(3):
        for partition in range(3):
            try_monitor_clock_tick(ts=now + timedelta(minutes=minute), partition=partition)
    try_monitor_clock_tick(ts=now + timedelta(minutes=2), partition=3)


@mock.patch("sentry.monitors.clock_dispatch.metrics")
@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_missing_partitions(
    dispatch_tick: mock.MagicMock, metrics_mock: mock.MagicMock
) -> None:
    now = timezone.now().replace(second=0, microsecond=0)

    # Run once as a process that has not seen a pulse, to get the ticks the
    # clock dispatches without the measurement
    run_short_partition_set_sequence(now)
    ticks_without_pulse = list(dispatch_tick.mock_calls)
    assert gauge_values(metrics_mock, "monitors.task.clock_missing_partitions") == []

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    redis_client.delete(MONITOR_TASKS_PARTITION_CLOCKS, MONITOR_TASKS_LAST_TRIGGERED_KEY)
    dispatch_tick.reset_mock()
    metrics_mock.reset_mock()

    # Run again after a pulse with 4 partitions
    seed_pulse(4)
    run_short_partition_set_sequence(now)

    # The set fills to 3 partitions, stays short by 1, then is complete
    assert gauge_values(metrics_mock, "monitors.task.clock_missing_partitions") == [
        3,
        2,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
    ]

    # The same ticks are dispatched as without the measurement
    assert dispatch_tick.mock_calls == ticks_without_pulse
    assert len(ticks_without_pulse) == 3


@mock.patch("sentry.monitors.clock_dispatch.metrics")
@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_stall_gap(
    dispatch_tick: mock.MagicMock,
    metrics_mock: mock.MagicMock,
    partition_set_state: PartitionSetState,
) -> None:
    """
    The stall gap grows while the partition clock set stays short, and goes
    back to zero once the set is complete.
    """
    seed_pulse(2)

    def last_stall_gap() -> float:
        return gauge_values(metrics_mock, "monitors.task.clock_stall_gap")[-1]

    with freeze_time() as frozen_time:
        now = timezone.now().replace(second=0, microsecond=0)

        # Only partition 0 is in the set, the stall starts now
        try_monitor_clock_tick(ts=now, partition=0)
        assert last_stall_gap() == 0

        # The set stays short and the gap grows
        frozen_time.shift(timedelta(seconds=30))
        try_monitor_clock_tick(ts=now + timedelta(seconds=30), partition=0)
        assert last_stall_gap() == pytest.approx(30)

        frozen_time.shift(timedelta(seconds=30))
        try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
        assert last_stall_gap() == pytest.approx(60)

        # Partition 1 arrives, the set is complete and the gap is zero
        frozen_time.shift(timedelta(seconds=30))
        try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=1)
        assert last_stall_gap() == 0
        assert partition_set_state.incomplete_since is None

        # A new pulse adds partition 2, a new stall starts from zero
        seed_pulse(3)
        frozen_time.shift(timedelta(seconds=30))
        try_monitor_clock_tick(ts=now + timedelta(minutes=2), partition=0)
        assert last_stall_gap() == 0

        frozen_time.shift(timedelta(seconds=15))
        try_monitor_clock_tick(ts=now + timedelta(minutes=2), partition=1)
        assert last_stall_gap() == pytest.approx(15)


@mock.patch("sentry.monitors.clock_dispatch.metrics")
@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_monitor_task_trigger_no_pulse_seen(
    dispatch_tick: mock.MagicMock,
    metrics_mock: mock.MagicMock,
    partition_set_state: PartitionSetState,
) -> None:
    """
    A process that has not seen a clock pulse with a partition list skips the
    measurement and still ticks the clock.
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # A pulse from before the partition list was added teaches nothing
    record_pulse_partitions({"message_type": "clock_pulse"})
    assert partition_set_state.expected_partitions is None

    try_monitor_clock_tick(ts=now, partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tick.mock_calls == [mock.call(now), mock.call(now + timedelta(minutes=1))]

    assert gauge_values(metrics_mock, "monitors.task.clock_missing_partitions") == []
    assert gauge_values(metrics_mock, "monitors.task.clock_stall_gap") == []


@override_settings(
    KAFKA_TOPIC_OVERRIDES={"monitors-clock-tick": "clock-tick-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"clock-tick-test-topic": "default"},
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.clock_dispatch._clock_tick_producer")
@override_options({"crons.system_incidents.collect_metrics": False})
def test_dispatch_to_kafka(clock_tick_producer_mock: mock.MagicMock) -> None:
    now = timezone.now().replace(second=0, microsecond=0)
    _dispatch_tick(now)

    message: ClockTick = {
        "ts": now.timestamp(),
    }
    clock_tick_producer_mock.produce.assert_called_with(
        Topic("clock-tick-test-topic"),
        KafkaPayload(None, json.dumps(message).encode("utf-8"), []),
    )
