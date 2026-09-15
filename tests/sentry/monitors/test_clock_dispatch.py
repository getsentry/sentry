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

HOLD_OPTION = "crons.clock_tick.hold_on_missing_partitions"
HOLD_MAX_SECONDS_OPTION = "crons.clock_tick.hold_max_seconds"

BASE_OPTIONS = {
    "crons.system_incidents.collect_metrics": False,
    HOLD_OPTION: False,
    HOLD_MAX_SECONDS_OPTION: 0,
}


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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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
@override_options(BASE_OPTIONS)
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


def get_redis_client():
    return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


def fill_partition_set(now: datetime, partition_count: int) -> None:
    """
    Every partition writes the same clock value, so the partition clock set is
    complete and the clock ticks once.
    """
    for partition in range(partition_count):
        try_monitor_clock_tick(ts=now, partition=partition)


def run_loss_sequence(now: datetime, lost_keys: list[str]) -> None:
    """
    A healthy set of 4 partitions ticks the clock, redis loses the given keys,
    then only partition 0 writes for five minutes before the other three
    partitions come back.
    """
    fill_partition_set(now, 4)
    get_redis_client().delete(*lost_keys)

    for minute in range(1, 6):
        try_monitor_clock_tick(ts=now + timedelta(minutes=minute), partition=0)


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True})
def test_hold_clock_tick_all_keys_lost(dispatch_tick: mock.MagicMock) -> None:
    """
    Redis loses the partition clock set and the last triggered timestamp. The
    clock holds while only one partition writes, and moves again once the set
    is complete.
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    run_loss_sequence(now, [MONITOR_TASKS_PARTITION_CLOCKS, MONITOR_TASKS_LAST_TRIGGERED_KEY])

    # One tick from the healthy set, then nothing while the set is short
    assert dispatch_tick.mock_calls == [mock.call(now)]

    # The missing partitions come back and the clock moves again. There is no
    # backfill here, because the last triggered timestamp was lost as well.
    for partition in (1, 2, 3):
        try_monitor_clock_tick(ts=now + timedelta(minutes=5), partition=partition)

    assert dispatch_tick.mock_calls == [
        mock.call(now),
        mock.call(now + timedelta(minutes=5)),
    ]


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True})
def test_hold_clock_tick_only_clock_set_lost(dispatch_tick: mock.MagicMock) -> None:
    """
    Redis loses only the partition clock set. The clock holds while the set is
    short, then backfills every minute it held.
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    run_loss_sequence(now, [MONITOR_TASKS_PARTITION_CLOCKS])

    # One tick from the healthy set, then nothing while the set is short
    assert dispatch_tick.mock_calls == [mock.call(now)]

    # The missing partitions come back. The held minutes are backfilled, so the
    # hold delayed the ticks and did not drop them.
    for partition in (1, 2, 3):
        try_monitor_clock_tick(ts=now + timedelta(minutes=5), partition=partition)

    assert dispatch_tick.mock_calls == [
        mock.call(now),
        mock.call(now + timedelta(minutes=1)),
        mock.call(now + timedelta(minutes=2)),
        mock.call(now + timedelta(minutes=3)),
        mock.call(now + timedelta(minutes=4)),
        mock.call(now + timedelta(minutes=5)),
    ]


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True})
def test_hold_clock_tick_no_bound_by_default(dispatch_tick: mock.MagicMock) -> None:
    """
    With the hold bound at its default of zero, the clock holds for as long as
    the partition set is short. Nothing lets the clock advance on its own.
    """
    seed_pulse(4)

    with freeze_time() as frozen_time:
        now = timezone.now().replace(second=0, microsecond=0)

        fill_partition_set(now, 4)
        assert dispatch_tick.call_count == 1

        get_redis_client().delete(MONITOR_TASKS_PARTITION_CLOCKS)

        # Partition 0 keeps writing for two hours while the set stays short
        for minute in range(1, 121):
            frozen_time.shift(timedelta(minutes=1))
            try_monitor_clock_tick(ts=now + timedelta(minutes=minute), partition=0)

        # The clock never moved past the tick from the healthy set
        assert dispatch_tick.mock_calls == [mock.call(now)]
        last_ts = get_redis_client().get(MONITOR_TASKS_LAST_TRIGGERED_KEY)
        assert int(last_ts) == int(now.timestamp())


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True, HOLD_MAX_SECONDS_OPTION: 600})
def test_hold_clock_tick_max_seconds(dispatch_tick: mock.MagicMock) -> None:
    """
    With a hold bound set, the clock holds until the set has been short for
    that long, then advances on the partitions that are present. The held
    minutes are backfilled, and the clock keeps moving while the set stays
    short.
    """
    seed_pulse(4)

    with freeze_time() as frozen_time:
        now = timezone.now().replace(second=0, microsecond=0)

        fill_partition_set(now, 4)
        assert dispatch_tick.mock_calls == [mock.call(now)]

        get_redis_client().delete(MONITOR_TASKS_PARTITION_CLOCKS)

        # The set goes short at minute 1. The stall gap reaches the bound of
        # ten minutes at minute 11, so the clock holds through minute 10.
        for minute in range(1, 11):
            frozen_time.shift(timedelta(minutes=1))
            try_monitor_clock_tick(ts=now + timedelta(minutes=minute), partition=0)
        assert dispatch_tick.mock_calls == [mock.call(now)]

        # At minute 11 the bound releases the hold. The clock follows partition
        # 0 and backfills the ten minutes it held.
        frozen_time.shift(timedelta(minutes=1))
        try_monitor_clock_tick(ts=now + timedelta(minutes=11), partition=0)
        assert dispatch_tick.mock_calls == [
            mock.call(now + timedelta(minutes=minute)) for minute in range(0, 12)
        ]

        # The set is still short, so the clock keeps following partition 0
        frozen_time.shift(timedelta(minutes=1))
        try_monitor_clock_tick(ts=now + timedelta(minutes=12), partition=0)
        assert dispatch_tick.mock_calls[-1] == mock.call(now + timedelta(minutes=12))
        assert dispatch_tick.call_count == 13


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True})
def test_hold_clock_tick_compares_partition_ids(dispatch_tick: mock.MagicMock) -> None:
    """
    A stale member can make the size of the partition clock set look complete
    while a live partition is missing. We compare the partition ids, so the
    clock still holds.
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    # A member for a partition that the topic no longer has
    get_redis_client().zadd(
        name=MONITOR_TASKS_PARTITION_CLOCKS,
        mapping={"part-9": int(now.timestamp())},
    )

    # Partitions 0 to 2 write, so the set holds 4 members but partition 3 is
    # missing
    for partition in range(3):
        try_monitor_clock_tick(ts=now, partition=partition)
    assert dispatch_tick.call_count == 0

    # Partition 3 arrives and the clock moves
    try_monitor_clock_tick(ts=now, partition=3)
    assert dispatch_tick.mock_calls == [mock.call(now)]


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({**BASE_OPTIONS, HOLD_OPTION: True})
def test_hold_clock_tick_no_pulse_seen(
    dispatch_tick: mock.MagicMock,
    partition_set_state: PartitionSetState,
) -> None:
    """
    A process that has not seen a clock pulse knows no partition list. It never
    holds the clock.
    """
    assert partition_set_state.expected_partitions is None

    now = timezone.now().replace(second=0, microsecond=0)

    try_monitor_clock_tick(ts=now, partition=0)
    try_monitor_clock_tick(ts=now + timedelta(minutes=1), partition=0)

    assert dispatch_tick.mock_calls == [mock.call(now), mock.call(now + timedelta(minutes=1))]


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options(BASE_OPTIONS)
def test_hold_clock_tick_option_off(dispatch_tick: mock.MagicMock) -> None:
    """
    With the option off the clock advances on the short set, which is the
    behavior before this change.
    """
    seed_pulse(4)
    now = timezone.now().replace(second=0, microsecond=0)

    run_loss_sequence(now, [MONITOR_TASKS_PARTITION_CLOCKS])

    # Partition 0 alone is the slowest partition, so the clock follows it
    assert dispatch_tick.mock_calls == [
        mock.call(now),
        mock.call(now + timedelta(minutes=1)),
        mock.call(now + timedelta(minutes=2)),
        mock.call(now + timedelta(minutes=3)),
        mock.call(now + timedelta(minutes=4)),
        mock.call(now + timedelta(minutes=5)),
    ]


@override_settings(
    KAFKA_TOPIC_OVERRIDES={"monitors-clock-tick": "clock-tick-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"clock-tick-test-topic": "default"},
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.clock_dispatch._clock_tick_producer")
@override_options(BASE_OPTIONS)
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
