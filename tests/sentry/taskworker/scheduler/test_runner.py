from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone

from sentry.conf.types.taskworker import crontab
from sentry.silo.base import SiloMode
from sentry.taskworker.app import TaskworkerApp
from sentry.taskworker.scheduler.runner import RunStorage, ScheduleRunner
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist
from sentry.utils.redis import redis_clusters


@pytest.fixture
def task_app() -> TaskworkerApp:
    app = TaskworkerApp(name="sentry")
    namespace = app.taskregistry.create_namespace("test")

    @namespace.register(name="valid")
    def test_func() -> None:
        pass

    @namespace.register(name="second")
    def second_func() -> None:
        pass

    @namespace.register(name="third")
    def third_func() -> None:
        pass

    return app


@pytest.fixture
def run_storage() -> RunStorage:
    redis = redis_clusters.get("default")
    redis.flushdb()
    return RunStorage(redis)


def test_runstorage_zero_duration(run_storage: RunStorage) -> None:
    with freeze_time("2025-07-19 14:25:00"):
        now = timezone.now()
        result = run_storage.set("test:do_stuff", now)
        assert result is True


def test_runstorage_double_set(run_storage: RunStorage) -> None:
    with freeze_time("2025-07-19 14:25:00"):
        now = timezone.now()
        first = run_storage.set("test:do_stuff", now)
        second = run_storage.set("test:do_stuff", now)

        assert first is True, "initial set should return true"
        assert second is False, "writing a key that exists should fail"


@pytest.mark.django_db
def test_schedulerunner_add_invalid(task_app) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            "invalid",
            {
                "task": "invalid",
                "schedule": timedelta(minutes=5),
            },
        )
    assert "Invalid task name" in str(err)

    with pytest.raises(KeyError) as key_err:
        schedule_set.add(
            "invalid",
            {
                "task": "test:invalid",
                "schedule": timedelta(minutes=5),
            },
        )
    assert "No task registered" in str(key_err)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            "valid",
            {
                "task": "test:valid",
                "schedule": timedelta(microseconds=99),
            },
        )
    assert "microseconds" in str(err)


@pytest.mark.django_db
def test_schedulerunner_tick_no_tasks(task_app: TaskworkerApp, run_storage: RunStorage) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 60


@pytest.mark.django_db
def test_schedulerunner_tick_one_task_time_remaining(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)

    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )
    # Last run was two minutes ago.
    with freeze_time("2025-01-24 14:23:00"):
        run_storage.set("test:valid", datetime(2025, 1, 24, 14, 28, 0, tzinfo=UTC))

    namespace = task_app.taskregistry.get("test")
    with freeze_time("2025-01-24 14:25:00"), patch.object(namespace, "send_task") as mock_send:
        sleep_time = schedule_set.tick()
        assert sleep_time == 180
        assert mock_send.call_count == 0

    last_run = run_storage.read("test:valid")
    assert last_run == datetime(2025, 1, 24, 14, 23, 0, tzinfo=UTC)


@pytest.mark.django_db
def test_schedulerunner_tick_one_task_spawned(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )

    # Last run was 5 minutes from the freeze_time below
    run_storage.read_many.return_value = {
        "test:valid": datetime(2025, 1, 24, 14, 19, 55),
    }
    run_storage.set.return_value = True

    namespace = task_app.taskregistry.get("test")
    with freeze_time("2025-01-24 14:25:00"), patch.object(namespace, "send_task") as mock_send:
        sleep_time = schedule_set.tick()
        assert sleep_time == 300
        assert mock_send.call_count == 1

        # scheduled tasks should not continue the scheduler trace
        send_args = mock_send.call_args
        assert send_args.args[0].headers["sentry-propagate-traces"] == "False"
        assert "sentry-trace" not in send_args.args[0].headers

    assert run_storage.set.call_count == 1
    # set() is called with the correct next_run time
    run_storage.set.assert_called_with("test:valid", datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC))


@pytest.mark.django_db
@patch("sentry.taskworker.scheduler.runner.capture_checkin")
def test_schedulerunner_tick_create_checkin(
    mock_capture_checkin: Mock, task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "important-task",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )

    # Last run was 5 minutes from the freeze_time below
    run_storage.read_many.return_value = {
        "test:valid": datetime(2025, 1, 24, 14, 19, 55),
    }
    run_storage.set.return_value = True
    mock_capture_checkin.return_value = "checkin-id"

    namespace = task_app.taskregistry.get("test")
    with (
        freeze_time("2025-01-24 14:25:00"),
        patch.object(namespace, "send_task") as mock_send,
    ):
        sleep_time = schedule_set.tick()
        assert sleep_time == 300

        assert mock_send.call_count == 1

        # assert that the activation had the correct headers
        send_args = mock_send.call_args
        assert "sentry-monitor-check-in-id" in send_args.args[0].headers
        assert send_args.args[0].headers["sentry-monitor-slug"] == "important-task"
        assert send_args.args[0].headers["sentry-propagate-traces"] == "False"
        assert "sentry-trace" not in send_args.args[0].headers

        # Ensure a checkin was created
        assert mock_capture_checkin.call_count == 1
        mock_capture_checkin.assert_called_with(
            monitor_slug="important-task",
            monitor_config={
                "schedule": {
                    "type": "interval",
                    "unit": "minute",
                    "value": 5,
                },
                "timezone": "UTC",
            },
            status="in_progress",
        )


@pytest.mark.django_db
def test_schedulerunner_tick_key_exists_no_spawn(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )

    namespace = task_app.taskregistry.get("test")
    with patch.object(namespace, "send_task") as mock_send, freeze_time("2025-01-24 14:25:00"):
        # Run tick() to initialize state in the scheduler. This will write a key to run_storage.
        sleep_time = schedule_set.tick()
        assert sleep_time == 300
        assert mock_send.call_count == 1

    with freeze_time("2025-01-24 14:30:00"):
        # Set a key into run_storage to simulate another scheduler running
        run_storage.delete("test:valid")
        assert run_storage.set("test:valid", timezone.now() + timedelta(minutes=2))

    # Our scheduler would wakeup and tick again.
    # The key exists in run_storage so we should not spawn a task.
    # last_run time is set to now to prevent tight loops with stale values
    with freeze_time("2025-01-24 14:30:02"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 300
        assert mock_send.call_count == 1


@pytest.mark.django_db
@thread_leak_allowlist(reason="taskworker", issue=97034)
def test_schedulerunner_tick_one_task_multiple_ticks(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 300

    with freeze_time("2025-01-24 14:26:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 240

    with freeze_time("2025-01-24 14:28:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 120


@pytest.mark.django_db
def test_schedulerunner_tick_one_task_multiple_ticks_crontab(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": crontab(minute="*/2"),
        },
    )

    namespace = task_app.taskregistry.get("test")
    with patch.object(namespace, "send_task") as mock_send:
        with freeze_time("2025-01-24 14:24:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 120
        assert mock_send.call_count == 1

        with freeze_time("2025-01-24 14:25:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 60

        # Remove key to simulate expiration
        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:26:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 120
        assert mock_send.call_count == 2


@pytest.mark.django_db
def test_schedulerunner_tick_multiple_tasks(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        },
    )
    schedule_set.add(
        "second",
        {
            "task": "test:second",
            "schedule": timedelta(minutes=2),
        },
    )

    namespace = task_app.taskregistry.get("test")
    with patch.object(namespace, "send_task") as mock_send:
        with freeze_time("2025-01-24 14:25:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 120

        assert mock_send.call_count == 2

        with freeze_time("2025-01-24 14:26:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 60

        assert mock_send.call_count == 2

        # Remove the redis key, as the ttl in redis doesn't respect freeze_time()
        run_storage.delete("test:second")
        with freeze_time("2025-01-24 14:27:01"):
            sleep_time = schedule_set.tick()
            # two minutes left on the 5 min task
            assert sleep_time == 120

        assert mock_send.call_count == 3


@pytest.mark.django_db
def test_schedulerunner_tick_fast_and_slow(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": timedelta(seconds=30),
        },
    )
    schedule_set.add(
        "second",
        {
            "task": "test:second",
            "schedule": crontab(minute="*/2"),
        },
    )

    namespace = task_app.taskregistry.get("test")
    with patch.object(namespace, "send_task") as mock_send:
        with freeze_time("2025-01-24 14:25:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:25:30"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["valid", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:26:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["valid", "valid", "second", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:26:30"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["valid", "valid", "second", "valid", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:27:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        assert run_storage.read("test:valid")
        called = extract_sent_tasks(mock_send)
        assert called == [
            "valid",
            "valid",
            "second",
            "valid",
            "valid",
            "valid",
        ]


def extract_sent_tasks(mock: Mock) -> list[str]:
    return [call[0][0].taskname for call in mock.call_args_list]


@pytest.mark.django_db
def test_schedulerunner_tick_stale_lock_no_tight_loop(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    """
    Test that a stale lock with long TTL doesn't cause a tight loop.

    This test reproduces the January 2, 2025 outage where a task's schedule
    was shortened (10h -> 10min) but the old Redis key still existed with
    a long TTL. The scheduler would get stuck in a tight loop because
    remaining_seconds() returned 0 for the "overdue" task.

    The fix sets last_run to now (instead of the stale Redis value) when
    we can't spawn, so remaining_seconds() returns the correct value.
    """
    run_storage_mock = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage_mock)
    schedule_set.add(
        "valid",
        {
            "task": "test:valid",
            "schedule": crontab(minute="*/10"),
        },
    )

    run_storage_mock.read_many.return_value = {
        "test:valid": datetime(2025, 1, 2, 10, 0, 0, tzinfo=UTC),
    }
    run_storage_mock.set.return_value = False
    run_storage_mock.read.return_value = datetime(2025, 1, 2, 10, 0, 0, tzinfo=UTC)

    namespace = task_app.taskregistry.get("test")
    with freeze_time("2025-01-02 12:10:00"), patch.object(namespace, "send_task") as mock_send:
        sleep_time = schedule_set.tick()
        assert sleep_time == 600
        assert mock_send.call_count == 0
        assert run_storage_mock.set.call_count == 1


@pytest.mark.django_db
def test_schedulerunner_tick_stale_lock_doesnt_starve_other_tasks(
    task_app: TaskworkerApp, run_storage: RunStorage
) -> None:
    """
    Test that a task with a stale lock doesn't prevent other tasks from running.

    This test verifies that when one task can't spawn due to a stale lock,
    other tasks (including those on the same schedule) can still run.
    """
    run_storage_mock = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=task_app, run_storage=run_storage_mock)
    schedule_set.add(
        "blocked-10min",
        {
            "task": "test:valid",
            "schedule": crontab(minute="*/10"),
        },
    )
    schedule_set.add(
        "working-7min",
        {
            "task": "test:second",
            "schedule": crontab(minute="*/7"),
        },
    )
    schedule_set.add(
        "working-10min",
        {
            "task": "test:third",
            "schedule": crontab(minute="*/10"),
        },
    )

    def mock_set(taskname: str, next_runtime: datetime) -> bool:
        if taskname == "test:valid":
            return False
        return True

    def mock_read(taskname: str) -> datetime | None:
        if taskname == "test:valid":
            return datetime(2025, 1, 2, 10, 0, 0, tzinfo=UTC)
        return None

    run_storage_mock.read_many.return_value = {
        "test:valid": datetime(2025, 1, 2, 10, 0, 0, tzinfo=UTC),
        "test:second": datetime(2025, 1, 2, 11, 56, 0, tzinfo=UTC),
        "test:third": datetime(2025, 1, 2, 11, 50, 0, tzinfo=UTC),
    }
    run_storage_mock.set.side_effect = mock_set
    run_storage_mock.read.side_effect = mock_read

    namespace = task_app.taskregistry.get("test")
    with freeze_time("2025-01-02 12:00:00"), patch.object(namespace, "send_task") as mock_send:
        schedule_set.tick()
        assert mock_send.call_count == 2
        called = extract_sent_tasks(mock_send)
        assert "second" in called
        assert "third" in called
        assert "valid" not in called


@pytest.mark.django_db
def test_schedulerunner_silo_limited_task_has_task_properties() -> None:
    app = TaskworkerApp(name="sentry")
    namespace = app.taskregistry.create_namespace("test")

    @namespace.register(
        name="region_task",
        at_most_once=True,
        wait_for_delivery=True,
        silo_mode=SiloMode.REGION,
    )
    def region_task() -> None:
        pass

    for attr in region_task.__dict__.keys():
        if attr.startswith("_") and not attr.startswith("__"):
            continue
        assert hasattr(region_task, attr)

    assert region_task.fullname == "test:region_task"
    assert region_task.namespace.name == "test"
    assert region_task.name == "region_task"
    assert region_task.at_most_once is True
    assert region_task.wait_for_delivery is True

    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(app=app, run_storage=run_storage)
    schedule_set.add(
        "region-task",
        {
            "task": "test:region_task",
            "schedule": timedelta(minutes=5),
        },
    )

    schedule_set.log_startup()

    assert len(schedule_set._entries) == 1
    entry = schedule_set._entries[0]
    assert entry.fullname == "test:region_task"
    assert entry.namespace == "test"
    assert entry.taskname == "region_task"
