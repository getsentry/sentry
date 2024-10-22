from datetime import timedelta
from unittest import mock

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.conf import settings
from django.test.utils import override_settings
from django.utils import timezone

from sentry.monitors.clock_dispatch import (
    MONITOR_VOLUME_HISTORY,
    _dispatch_tick,
    bulk_update_check_in_volume,
    try_monitor_clock_tick,
    update_check_in_volume,
)
from sentry.utils import json, redis


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tick")
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
def test_dispatch_to_kafka(clock_tick_producer_mock):
    now = timezone.now().replace(second=0, microsecond=0)
    _dispatch_tick(now)

    clock_tick_producer_mock.produce.assert_called_with(
        Topic("clock-tick-test-topic"),
        KafkaPayload(None, json.dumps({"ts": now.timestamp()}).encode("utf-8"), []),
    )


def test_update_check_in_volume():
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    now = timezone.now().replace(second=5)

    update_check_in_volume(now)
    update_check_in_volume(now + timedelta(seconds=5))
    update_check_in_volume(now + timedelta(minutes=1))

    def make_key(offset: timedelta) -> str:
        ts = now.replace(second=0, microsecond=0) + offset
        return MONITOR_VOLUME_HISTORY.format(int(ts.timestamp()))

    minute_0 = redis_client.get(make_key(timedelta()))
    minute_1 = redis_client.get(make_key(timedelta(minutes=1)))

    assert minute_0 == "2"
    assert minute_1 == "1"


def test_bulk_update_check_in_volume():
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    now = timezone.now().replace(second=5)
    items = [
        now,
        now + timedelta(seconds=10),
        now + timedelta(seconds=30),
        now + timedelta(minutes=1),
        now + timedelta(minutes=3),
    ]
    bulk_update_check_in_volume(items)

    def make_key(offset: timedelta) -> str:
        ts = now.replace(second=0, microsecond=0) + offset
        return MONITOR_VOLUME_HISTORY.format(int(ts.timestamp()))

    minute_0 = redis_client.get(make_key(timedelta()))
    minute_1 = redis_client.get(make_key(timedelta(minutes=1)))
    minute_2 = redis_client.get(make_key(timedelta(minutes=2)))
    minute_3 = redis_client.get(make_key(timedelta(minutes=3)))

    assert minute_0 == "3"
    assert minute_1 == "1"
    assert minute_2 is None
    assert minute_3 == "1"
