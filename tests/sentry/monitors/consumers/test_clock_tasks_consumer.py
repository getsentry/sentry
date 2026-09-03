import time
from collections.abc import Callable, Mapping
from concurrent.futures import Future
from contextlib import ExitStack
from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.db import connections
from django.test.utils import CaptureQueriesContext
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
    MonitorIncident,
    MonitorStatus,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

# The batched-parallel path bulk-loads from the database before fanning out,
# so even tests that mock the task functions need database access.
pytestmark = pytest.mark.django_db(databases=["default", "secondary"])

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
    assert mock_mark_environment_missing.mock_calls[0] == mock.call(1, ts, mock.ANY)


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
    assert mock_mark_checkin_timeout.mock_calls[0] == mock.call(1, ts, mock.ANY)


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

    def slow_group(tasks: list[MonitorsClockTasks], prefetch: Any = None) -> None:
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
    assert mock.call(1, TASK_TS, mock.ANY) in mock_mark_environment_missing.mock_calls
    assert mock.call(2, TASK_TS, mock.ANY) in mock_mark_environment_missing.mock_calls


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
    assert mock_mark_environment_missing.mock_calls[0] == mock.call(1, ts, mock.ANY)


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

    def test_newer_checkin_guard_is_per_checkin_not_per_batch(self) -> None:
        """
        A timeout is ignored when the environment has a newer OK/ERROR check-in.

        The batched path bulk-loads the newest status-affecting check-in per
        environment using a single scan floor for the whole batch. That floor
        must not leak across environments: the comparison stays per check-in.
        """
        ts = timezone.now().replace(second=0, microsecond=0)

        # Superseded by a later OK check-in. Also sets the batch scan floor.
        superseded = self._create_monitor_environment(ts, "superseded")
        superseded_checkin = MonitorCheckIn.objects.create(
            project_id=superseded.monitor.project_id,
            monitor=superseded.monitor,
            monitor_environment=superseded,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=30),
        )
        MonitorCheckIn.objects.create(
            project_id=superseded.monitor.project_id,
            monitor=superseded.monitor,
            monitor_environment=superseded,
            status=CheckInStatus.OK,
            date_added=ts - timedelta(minutes=20),
        )

        # Still failing, and well after the floor set above.
        failing = self._create_monitor_environment(ts, "still-failing")
        failing_checkin = MonitorCheckIn.objects.create(
            project_id=failing.monitor.project_id,
            monitor=failing.monitor,
            monitor_environment=failing,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=5),
        )

        # The discriminating case: has an OK check-in, but older than the
        # timed-out one. Comparing against the batch floor would miss this.
        stale_ok = self._create_monitor_environment(ts, "stale-ok")
        MonitorCheckIn.objects.create(
            project_id=stale_ok.monitor.project_id,
            monitor=stale_ok.monitor,
            monitor_environment=stale_ok,
            status=CheckInStatus.OK,
            date_added=ts - timedelta(minutes=25),
        )
        stale_ok_checkin = MonitorCheckIn.objects.create(
            project_id=stale_ok.monitor.project_id,
            monitor=stale_ok.monitor,
            monitor_environment=stale_ok,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=10),
        )

        consumer = create_consumer("batched-parallel", {"max_batch_size": 3, "max_workers": 4})
        for offset, checkin in enumerate(
            (superseded_checkin, failing_checkin, stale_ok_checkin), start=1
        ):
            send_task(
                consumer,
                ts,
                {
                    "type": "mark_timeout",
                    "ts": ts.timestamp(),
                    "monitor_environment_id": checkin.monitor_environment_id,
                    "checkin_id": checkin.id,
                },
                offset=offset,
            )
        flush(consumer)

        # All rows are timed out regardless
        for checkin in (superseded_checkin, failing_checkin, stale_ok_checkin):
            checkin.refresh_from_db()
            assert checkin.status == CheckInStatus.TIMEOUT

        # ...but only the one with nothing newer affects monitor status
        superseded.refresh_from_db()
        failing.refresh_from_db()
        stale_ok.refresh_from_db()
        assert superseded.status == MonitorStatus.OK
        assert failing.status == MonitorStatus.ERROR
        assert stale_ok.status == MonitorStatus.ERROR

    @override_options({"crons.clock_tasks.prefetch_batch": True})
    @mock.patch(
        "sentry.monitors.consumers.clock_tasks_consumer.prefetch_clock_tasks",
        side_effect=Exception("boom"),
    )
    def test_batch_still_processes_when_prefetch_fails(self, mock_prefetch: mock.MagicMock) -> None:
        """
        A failed prefetch must not lose the batch.

        Every task can fall back to issuing its own reads, so a transient read
        error degrades throughput rather than dropping work.
        """
        ts = timezone.now().replace(second=0, microsecond=0)
        monitor_environment = self._create_monitor_environment(ts, "prefetch-fails")

        consumer = create_consumer("batched-parallel", {"max_batch_size": 1, "max_workers": 2})
        send_task(
            consumer,
            ts,
            {
                "type": "mark_missing",
                "ts": ts.timestamp(),
                "monitor_environment_id": monitor_environment.id,
            },
            offset=1,
        )
        flush(consumer)

        assert mock_prefetch.call_count == 1

        # The miss was still recorded via the per-task fallback
        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment, status=CheckInStatus.MISSED
        ).exists()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

    def test_multiple_timeouts_in_one_group_judged_individually(self) -> None:
        """
        Several timeouts for the SAME environment share one group, and the
        batched path answers all of them from a single loaded value.

        That value is the newest OK/ERROR check-in; each task must still be
        judged against its own date_added, so one can be superseded while
        another is not.
        """
        ts = timezone.now().replace(second=0, microsecond=0)
        monitor_environment = self._create_monitor_environment(ts, "two-timeouts")

        # Superseded: an OK check-in landed after it
        older = MonitorCheckIn.objects.create(
            project_id=monitor_environment.monitor.project_id,
            monitor=monitor_environment.monitor,
            monitor_environment=monitor_environment,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=60),
        )
        MonitorCheckIn.objects.create(
            project_id=monitor_environment.monitor.project_id,
            monitor=monitor_environment.monitor,
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
            date_added=ts - timedelta(minutes=40),
        )
        # Not superseded: nothing OK/ERROR after it
        newer = MonitorCheckIn.objects.create(
            project_id=monitor_environment.monitor.project_id,
            monitor=monitor_environment.monitor,
            monitor_environment=monitor_environment,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=20),
        )

        consumer = create_consumer("batched-parallel", {"max_batch_size": 2, "max_workers": 4})
        for offset, checkin in enumerate((older, newer), start=1):
            send_task(
                consumer,
                ts,
                {
                    "type": "mark_timeout",
                    "ts": ts.timestamp(),
                    "monitor_environment_id": monitor_environment.id,
                    "checkin_id": checkin.id,
                },
                offset=offset,
            )
        flush(consumer)

        for checkin in (older, newer):
            checkin.refresh_from_db()
            assert checkin.status == CheckInStatus.TIMEOUT

        # The un-superseded one drove the incident. A single shared answer
        # for the group would not produce this.
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

    def test_mixed_tasks_for_one_environment_share_state(self) -> None:
        """
        A timeout and a miss for the SAME environment land in one batch and one
        group. The first mutates the environment row; the second must observe
        that, not a stale copy of it.
        """
        ts = timezone.now().replace(second=0, microsecond=0)
        monitor_environment = self._create_monitor_environment(ts, "mixed-monitor")

        checkin = MonitorCheckIn.objects.create(
            project_id=monitor_environment.monitor.project_id,
            monitor=monitor_environment.monitor,
            monitor_environment=monitor_environment,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=5),
        )

        consumer = create_consumer("batched-parallel", {"max_batch_size": 2, "max_workers": 4})
        send_task(
            consumer,
            ts,
            {
                "type": "mark_timeout",
                "ts": ts.timestamp(),
                "monitor_environment_id": monitor_environment.id,
                "checkin_id": checkin.id,
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

        checkin.refresh_from_db()
        assert checkin.status == CheckInStatus.TIMEOUT

        # The miss was still recorded, and the environment ended in an incident
        assert MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment, status=CheckInStatus.MISSED
        ).exists()

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

        # Exactly one open incident, not one per task
        assert (
            MonitorIncident.objects.filter(
                monitor_environment=monitor_environment, resolving_checkin=None
            ).count()
            == 1
        )

    @override_options({"crons.clock_tasks.prefetch_batch": True})
    def test_timeout_reads_do_not_scale_with_batch_size(self) -> None:
        """
        Per-task reads are bulk-loaded once for the whole batch, so the query
        cost per message must fall as the batch grows.

        Without the prefetch each mark_timeout issues its own check-in fetch,
        status write and "newer status-affecting check-in" existence check,
        which measures at a flat ~4 queries per message no matter the batch
        size. Bulk-loading the two reads brings that to ~2.
        """
        ts = timezone.now().replace(second=0, microsecond=0)

        def run(count: int, label: str) -> float:
            checkins = []
            for i in range(count):
                monitor_environment = self._create_monitor_environment(ts, f"{label}-{i}")
                # Already in an incident, which is the state a backlogged
                # monitor is in by the time its timeouts are processed.
                MonitorEnvironment.objects.filter(id=monitor_environment.id).update(
                    status=MonitorStatus.ERROR
                )
                checkins.append(
                    MonitorCheckIn.objects.create(
                        project_id=monitor_environment.monitor.project_id,
                        monitor=monitor_environment.monitor,
                        monitor_environment=monitor_environment,
                        status=CheckInStatus.IN_PROGRESS,
                        date_added=ts - timedelta(minutes=5),
                    )
                )

            consumer = create_consumer(
                "batched-parallel", {"max_batch_size": count, "max_workers": 4}
            )
            with ExitStack() as stack:
                captured = [
                    stack.enter_context(CaptureQueriesContext(connections[alias]))
                    for alias in connections
                ]
                for offset, checkin in enumerate(checkins, start=1):
                    send_task(
                        consumer,
                        ts,
                        {
                            "type": "mark_timeout",
                            "ts": ts.timestamp(),
                            "monitor_environment_id": checkin.monitor_environment_id,
                            "checkin_id": checkin.id,
                        },
                        offset=offset,
                    )
                flush(consumer)
                queries = sum(len(capture) for capture in captured)

            # The work really happened
            assert (
                MonitorCheckIn.objects.filter(
                    id__in=[checkin.id for checkin in checkins],
                    status=CheckInStatus.TIMEOUT,
                ).count()
                == count
            )
            return queries / count

        small = run(4, "timeout-small")
        large = run(16, "timeout-large")

        # Amortising the bulk loads means a bigger batch costs less per message
        assert large < small, f"queries per message did not improve: {small} -> {large}"

        # Under the ~4/message the unbatched path costs. What remains is the
        # status UPDATE and `active_incident`, which this does not touch.
        assert large < 3, f"{large} queries per message"


@mock.patch(
    "sentry.monitors.consumers.clock_tasks_consumer.ContextPropagatingThreadPoolExecutor",
    InlineExecutor,
)
class MonitorClockTasksConsumerOrderingPrefetchTest(MonitorClockTasksConsumerOrderingTest):
    """
    The same end-to-end coverage with the batch prefetch enabled.

    Bulk-loading must not change any observable behaviour, so the entire
    ordering suite is re-run against it.
    """

    def setUp(self) -> None:
        super().setUp()
        # `override_options` is a context manager, decorating the class with it
        # would replace the class and stop pytest collecting it.
        overridden = override_options({"crons.clock_tasks.prefetch_batch": True})
        overridden.__enter__()
        self.addCleanup(overridden.__exit__, None, None, None)
