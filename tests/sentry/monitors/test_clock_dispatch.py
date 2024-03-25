from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.monitors.clock_dispatch import try_monitor_tasks_trigger


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tasks")
def test_monitor_task_trigger(dispatch_tasks):
    now = timezone.now().replace(second=0, microsecond=0)

    # Assumes a single partition for simplicitly. Multi-partition cases are
    # covered in further test cases.

    # First checkin triggers tasks
    try_monitor_tasks_trigger(ts=now, partition=0)
    assert dispatch_tasks.call_count == 1

    # 5 seconds later does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=5), partition=0)
    assert dispatch_tasks.call_count == 1

    # a minute later DOES trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tasks.call_count == 2

    # Same time does NOT trigger the task
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    assert dispatch_tasks.call_count == 2

    # A skipped minute triggers the task AND captures an error
    with mock.patch("sentry_sdk.capture_message") as capture_message:
        assert capture_message.call_count == 0
        try_monitor_tasks_trigger(ts=now + timedelta(minutes=3, seconds=5), partition=0)
        assert dispatch_tasks.call_count == 3
        capture_message.assert_called_with("Monitor task dispatch minute skipped")


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tasks")
def test_monitor_task_trigger_partition_desync(dispatch_tasks):
    """
    When consumer partitions are not completely synchronized we may read
    timestamps in a non-monotonic order. In this scenario we want to make
    sure we still only trigger once
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # First message in partition 0 with timestamp just after the minute
    # boundary triggers the task
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1), partition=0)
    assert dispatch_tasks.call_count == 1

    # Second message in a partition 1 has a timestamp just before the minute
    # boundary, should not trigger anything since we've already ticked ahead of
    # this
    try_monitor_tasks_trigger(ts=now - timedelta(seconds=1), partition=1)
    assert dispatch_tasks.call_count == 1

    # Third message in partition 1 again just after the minute boundary does
    # NOT trigger the task, we've already ticked at that time.
    try_monitor_tasks_trigger(ts=now + timedelta(seconds=1), partition=1)
    assert dispatch_tasks.call_count == 1

    # Next two messages in both partitions move the clock forward
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1, seconds=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1, seconds=1), partition=1)
    assert dispatch_tasks.call_count == 2


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tasks")
def test_monitor_task_trigger_partition_sync(dispatch_tasks):
    """
    When the kafka topic has multiple partitions we want to only tick our clock
    forward once all partitions have caught up. This test simulates that
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_tasks_trigger(ts=now, partition=0)
    try_monitor_tasks_trigger(ts=now, partition=1)
    try_monitor_tasks_trigger(ts=now, partition=2)
    try_monitor_tasks_trigger(ts=now, partition=3)
    assert dispatch_tasks.call_count == 1
    assert dispatch_tasks.mock_calls[0] == mock.call(now)

    # Tick forward 3 of the partitions, global clock does not tick
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=2)
    assert dispatch_tasks.call_count == 1

    # Slowest partition ticks forward, global clock ticks
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=3)
    assert dispatch_tasks.call_count == 2
    assert dispatch_tasks.mock_calls[1] == mock.call(now + timedelta(minutes=1))


@mock.patch("sentry.monitors.clock_dispatch._dispatch_tasks")
def test_monitor_task_trigger_partition_tick_skip(dispatch_tasks):
    """
    In a scenario where all partitions move multiple ticks past the slowest
    partition we may end up skipping a tick.
    """
    now = timezone.now().replace(second=0, microsecond=0)

    # Tick for 4 partitions
    try_monitor_tasks_trigger(ts=now, partition=0)
    try_monitor_tasks_trigger(ts=now, partition=1)
    try_monitor_tasks_trigger(ts=now, partition=2)
    try_monitor_tasks_trigger(ts=now, partition=3)
    assert dispatch_tasks.call_count == 1
    assert dispatch_tasks.mock_calls[0] == mock.call(now)

    # Tick forward twice for 3 partitions
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=1), partition=2)

    try_monitor_tasks_trigger(ts=now + timedelta(minutes=2), partition=0)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=3), partition=1)
    try_monitor_tasks_trigger(ts=now + timedelta(minutes=3), partition=2)
    assert dispatch_tasks.call_count == 1

    # Slowest partition catches up, but has a timestamp gap, capture the fact
    # that we skipped a minute
    with mock.patch("sentry_sdk.capture_message") as capture_message:
        assert capture_message.call_count == 0
        try_monitor_tasks_trigger(ts=now + timedelta(minutes=2), partition=3)
        capture_message.assert_called_with("Monitor task dispatch minute skipped")

    # XXX(epurkhiser): Another approach we could take here is to detect the
    # skipped minute and generate a tick for that minute, since we know
    # processed past that minute.
    #
    # This still could be a problem though since it may mean we will not
    # produce missed check-ins since the monitor already may have already
    # checked-in after and moved the `next_checkin_latest` forward.
    #
    # In practice this should almost never happen since we have a high volume of

    assert dispatch_tasks.call_count == 2
    assert dispatch_tasks.mock_calls[1] == mock.call(now + timedelta(minutes=2))
