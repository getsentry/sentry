from datetime import timedelta
from unittest import mock

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.test.utils import override_settings
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tick_v1 import ClockTick

from sentry.monitors.clock_dispatch import _dispatch_tick, try_monitor_clock_tick
from sentry.monitors.types import TickVolumeAnomolyResult
from sentry.testutils.helpers.options import override_options
from sentry.utils import json


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
@override_options({"crons.tick_volume_anomaly_detection": False})
def test_monitor_task_trigger(dispatch_tick):
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
@override_options({"crons.tick_volume_anomaly_detection": False})
def test_monitor_task_trigger_partition_desync(dispatch_tick):
    """
    When consumer partitions are not completely synchronized we may read
    timestamps in a non-monotonic order. In this scenario we want to make
    sure we still only trigger once
    """
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
@override_options({"crons.tick_volume_anomaly_detection": False})
def test_monitor_task_trigger_partition_sync(dispatch_tick):
    """
    When the kafka topic has multiple partitions we want to only tick our clock
    forward once all partitions have caught up. This test simulates that
    """
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
@override_options({"crons.tick_volume_anomaly_detection": False})
def test_monitor_task_trigger_partition_tick_skip(dispatch_tick):
    """
    In a scenario where all partitions move multiple ticks past the slowest
    partition we may end up skipping a tick. In this scenario we will backfill
    those ticks
    """
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


@override_settings(KAFKA_TOPIC_OVERRIDES={"monitors-clock-tick": "clock-tick-test-topic"})
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.clock_dispatch._clock_tick_producer")
@override_options({"crons.tick_volume_anomaly_detection": False})
def test_dispatch_to_kafka(clock_tick_producer_mock):
    now = timezone.now().replace(second=0, microsecond=0)
    _dispatch_tick(now)

    message: ClockTick = {
        "ts": now.timestamp(),
        "volume_anomaly_result": TickVolumeAnomolyResult.NORMAL.value,
    }
    clock_tick_producer_mock.produce.assert_called_with(
        Topic("clock-tick-test-topic"),
        KafkaPayload(None, json.dumps(message).encode("utf-8"), []),
    )
