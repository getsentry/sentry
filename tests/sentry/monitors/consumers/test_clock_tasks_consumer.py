import time
from collections.abc import Callable, Mapping
from concurrent.futures import Future
from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MonitorsClockTasks

from sentry.monitors.consumers.clock_tasks_consumer import (
    MONITORS_CLOCK_TASKS_CODEC,
    MonitorClockTasksStrategyFactory,
)
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
)
from sentry.testutils.cases import TestCase

partition = Partition(Topic("test"), 0)

# Both modes are exercised by every test to prove the parallel path behaves
# identically to the serial one.
ALL_MODES = ["serial", "batched-parallel"]

TASK_TS = datetime(2020, 6, 1, tzinfo=UTC)

MARK_MISSING_ENV_1: MonitorsClockTasks = {
    "type": "mark_missing",
    "ts": TASK_TS.timestamp(),
    "monitor_environment_id": 1,
}
MARK_MISSING_ENV_2: MonitorsClockTasks = {
    "type": "mark_missing",
    "ts": TASK_TS.timestamp(),
    "monitor_environment_id": 2,
}


def create_consumer(
    mode: str = "serial",
    factory_opts: Mapping[str, Any] | None = None,
    commit: mock.Mock | None = None,
) -> ProcessingStrategy[KafkaPayload]:
    opts: dict[str, Any] = {"mode": mode, **(factory_opts or {})}
    factory = MonitorClockTasksStrategyFactory(**opts)
    return factory.create_with_partitions(commit or mock.Mock(), {partition: 0})


def send_task(
    consumer: ProcessingStrategy[KafkaPayload],
    ts: datetime,
    task: MonitorsClockTasks,
    key: bytes | None = b"fake-key",
    offset: int = 1,
) -> None:
    value = BrokerValue(
        KafkaPayload(key, MONITORS_CLOCK_TASKS_CODEC.encode(task), []),
        partition,
        offset,
        ts,
    )
    consumer.submit(Message(value))


def flush(consumer: ProcessingStrategy[KafkaPayload]) -> None:
    """
    Force any pending batch to be processed and any staged offset to be
    committed. In serial mode there is no batch, so this only commits.
    """
    consumer.join()


@pytest.mark.parametrize("mode", ALL_MODES)
@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_environment_missing")
def test_dispatch_mark_missing(mock_mark_environment_missing: mock.MagicMock, mode: str) -> None:
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer(mode)
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 1},
    )
    flush(consumer)

    assert mock_mark_environment_missing.call_count == 1
    assert mock_mark_environment_missing.mock_calls[0] == mock.call(1, ts)


@pytest.mark.parametrize("mode", ALL_MODES)
@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_checkin_timeout")
def test_dispatch_mark_timeout(mock_mark_checkin_timeout: mock.MagicMock, mode: str) -> None:
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer(mode)
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
    flush(consumer)

    assert mock_mark_checkin_timeout.call_count == 1
    assert mock_mark_checkin_timeout.mock_calls[0] == mock.call(1, ts)


@pytest.mark.parametrize("mode", ALL_MODES)
@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_checkin_unknown")
def test_dispatch_mark_unknown(mock_mark_checkin_unknown: mock.MagicMock, mode: str) -> None:
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer(mode)
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
    flush(consumer)

    assert mock_mark_checkin_unknown.call_count == 1
    assert mock_mark_checkin_unknown.mock_calls[0] == mock.call(1, ts)


@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.process_clock_task_group")
def test_parallel_grouping(mock_process_clock_task_group: mock.MagicMock) -> None:
    """
    Tasks are grouped by monitor_environment_id, NOT by the Kafka key, and each
    group is submitted to the executor as a single serial unit.
    """
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer(
        "batched-parallel",
        {"max_batch_size": 4, "max_workers": 1},
    )

    # Two tasks for env 1, two for env 2. The Kafka keys are deliberately
    # useless here to prove grouping uses the decoded payload.
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 1},
        key=None,
    )
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 2},
        key=None,
    )
    send_task(
        consumer,
        ts,
        {
            "type": "mark_timeout",
            "ts": ts.timestamp(),
            "monitor_environment_id": 1,
            "checkin_id": 5,
        },
        key=None,
    )
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 2},
        key=None,
    )

    # Batch is full, nothing has been dispatched yet
    assert mock_process_clock_task_group.call_count == 0

    flush(consumer)

    assert mock_process_clock_task_group.call_count == 2

    groups = [call.args[0] for call in mock_process_clock_task_group.mock_calls]
    groups.sort(key=lambda group: group[0]["monitor_environment_id"])

    env_1, env_2 = groups

    # Env 1 keeps mark_missing before mark_timeout
    assert [task["type"] for task in env_1] == ["mark_missing", "mark_timeout"]
    assert all(task["monitor_environment_id"] == 1 for task in env_1)

    assert [task["type"] for task in env_2] == ["mark_missing", "mark_missing"]
    assert all(task["monitor_environment_id"] == 2 for task in env_2)


@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.process_clock_task_group")
def test_offsets_commit_only_after_every_group_finishes(
    mock_process_clock_task_group: mock.MagicMock,
) -> None:
    """
    `wait(futures)` is a barrier in front of CommitOffsets. Offsets must not
    advance while a group is still running, otherwise a crash mid-batch drops
    the unfinished tasks.
    """
    ts = timezone.now().replace(second=0, microsecond=0)

    finished_groups: list[int] = []
    groups_finished_at_commit: list[int] = []

    def slow_group(tasks: list[MonitorsClockTasks]) -> None:
        time.sleep(0.05)
        finished_groups.append(len(tasks))

    mock_process_clock_task_group.side_effect = slow_group

    commit = mock.Mock()
    commit.side_effect = lambda *args, **kwargs: groups_finished_at_commit.append(
        len(finished_groups)
    )

    consumer = create_consumer(
        "batched-parallel",
        {"max_batch_size": 2, "max_workers": 2},
        commit=commit,
    )

    # Two envs, so two groups run concurrently on two workers
    send_task(consumer, ts, MARK_MISSING_ENV_1, offset=1)
    send_task(consumer, ts, MARK_MISSING_ENV_2, offset=2)

    flush(consumer)

    # Both groups had completed by the time the first commit was made. Without
    # the barrier the commit lands while the workers are still sleeping.
    assert groups_finished_at_commit[0] == 2


@pytest.mark.parametrize("mode", ALL_MODES)
@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_environment_missing")
def test_failed_task_does_not_stop_the_batch(
    mock_mark_environment_missing: mock.MagicMock, mode: str
) -> None:
    """
    A task that raises is logged and skipped. Every other task in the batch,
    including the rest of its own group, still runs.
    """
    ts = timezone.now().replace(second=0, microsecond=0)

    mock_mark_environment_missing.side_effect = Exception("boom")

    consumer = create_consumer(mode, {"max_batch_size": 3, "max_workers": 2})

    # Two tasks for env 1 (one group) and one for env 2 (a second group)
    send_task(consumer, ts, MARK_MISSING_ENV_1, offset=1)
    send_task(consumer, ts, MARK_MISSING_ENV_1, offset=2)
    send_task(consumer, ts, MARK_MISSING_ENV_2, offset=3)

    flush(consumer)

    # Every task was attempted. A failure aborted neither the rest of its own
    # group nor the other group in the batch.
    assert mock_mark_environment_missing.call_count == 3
    assert mock.call(1, TASK_TS) in mock_mark_environment_missing.mock_calls
    assert mock.call(2, TASK_TS) in mock_mark_environment_missing.mock_calls


@pytest.mark.parametrize("mode", ALL_MODES)
@mock.patch("sentry.monitors.consumers.clock_tasks_consumer.mark_environment_missing")
def test_undecodable_message_is_skipped(
    mock_mark_environment_missing: mock.MagicMock, mode: str
) -> None:
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer(mode, {"max_batch_size": 2})

    consumer.submit(
        Message(
            BrokerValue(KafkaPayload(b"fake-key", b"this-is-not-msgpack", []), partition, 1, ts)
        )
    )
    send_task(
        consumer,
        ts,
        {"type": "mark_missing", "ts": ts.timestamp(), "monitor_environment_id": 1},
        offset=2,
    )
    flush(consumer)

    assert mock_mark_environment_missing.call_count == 1
    assert mock_mark_environment_missing.mock_calls[0] == mock.call(1, ts)


T = TypeVar("T")


class InlineExecutor:
    """
    Stands in for the ThreadPoolExecutor so that grouped work runs on the
    calling thread.

    Django database connections are thread-local, so work done on a pool
    thread cannot see (or be rolled back with) the transaction a `TestCase`
    wraps each test in. Running the groups inline keeps the property under
    test -- how tasks are grouped, and that a group runs serially in order --
    while leaving the database usable.
    """

    def __init__(self, max_workers: int | None = None) -> None:
        pass

    def submit(self, fn: Callable[..., T], *args: Any, **kwargs: Any) -> Future[T]:
        future: Future[T] = Future()
        future.set_running_or_notify_cancel()
        try:
            future.set_result(fn(*args, **kwargs))
        except BaseException as e:
            future.set_exception(e)
        return future

    def shutdown(self) -> None:
        pass


@mock.patch(
    "sentry.monitors.consumers.clock_tasks_consumer.ContextPropagatingThreadPoolExecutor",
    InlineExecutor,
)
class MonitorClockTasksConsumerOrderingTest(TestCase):
    """
    End-to-end ordering coverage against real database state.
    """

    def _create_monitor_environment(self, ts: datetime, slug: str) -> MonitorEnvironment:
        # `create_monitor` already defaults to a "* * * * *" crontab schedule
        monitor = self.create_monitor(slug=slug)
        return self.create_monitor_environment(
            monitor=monitor,
            environment_id=self.environment.id,
            last_checkin=ts - timedelta(minutes=3),
            next_checkin=ts - timedelta(minutes=2),
            next_checkin_latest=ts - timedelta(minutes=1),
            status=MonitorStatus.OK,
        )

    def test_same_environment_is_applied_in_order(self) -> None:
        """
        Two mark_missing tasks for the SAME environment land in one batch. They
        must apply serially and in order, advancing next_checkin_latest one
        schedule step at a time.
        """
        ts = timezone.now().replace(second=0, microsecond=0)
        monitor_environment = self._create_monitor_environment(ts, "ordered-monitor")

        consumer = create_consumer(
            "batched-parallel",
            {"max_batch_size": 2, "max_workers": 4},
        )

        # The second task is one minute later, mirroring two consecutive clock
        # ticks that both found this environment overdue.
        send_task(
            consumer,
            ts,
            {
                "type": "mark_missing",
                "ts": (ts - timedelta(minutes=1)).timestamp(),
                "monitor_environment_id": monitor_environment.id,
            },
            offset=1,
        )
        send_task(
            consumer,
            ts,
            {
                "type": "mark_missing",
                "ts": ts.timestamp(),
                "monitor_environment_id": monitor_environment.id,
            },
            offset=2,
        )
        flush(consumer)

        checkins = list(
            MonitorCheckIn.objects.filter(
                monitor_environment=monitor_environment,
                status=CheckInStatus.MISSED,
            ).order_by("date_added")
        )

        # Both misses were recorded, one per schedule step. Out-of-order
        # processing produces only one, since the second task's
        # `next_checkin_latest__lte=ts` guard would not match.
        assert len(checkins) == 2
        assert checkins[0].expected_time == ts - timedelta(minutes=2)
        assert checkins[1].expected_time == ts - timedelta(minutes=1)

        monitor_environment.refresh_from_db()
        assert monitor_environment.next_checkin == ts
        assert monitor_environment.status == MonitorStatus.ERROR

    def test_different_environments_all_applied(self) -> None:
        """
        Tasks for unrelated environments in one batch all get applied.
        """
        ts = timezone.now().replace(second=0, microsecond=0)
        monitor_environments = [
            self._create_monitor_environment(ts, f"parallel-monitor-{i}") for i in range(4)
        ]

        consumer = create_consumer(
            "batched-parallel",
            {"max_batch_size": 4, "max_workers": 4},
        )

        for offset, monitor_environment in enumerate(monitor_environments):
            send_task(
                consumer,
                ts,
                {
                    "type": "mark_missing",
                    "ts": ts.timestamp(),
                    "monitor_environment_id": monitor_environment.id,
                },
                offset=offset,
            )
        flush(consumer)

        for monitor_environment in monitor_environments:
            assert MonitorCheckIn.objects.filter(
                monitor_environment=monitor_environment,
                status=CheckInStatus.MISSED,
            ).exists()
            monitor_environment.refresh_from_db()
            assert monitor_environment.status == MonitorStatus.ERROR
