from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.scheduler.runner import RunStorage, ScheduleRunner
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.redis import redis_clusters


@pytest.fixture
def taskregistry() -> TaskRegistry:
    registry = TaskRegistry()
    namespace = registry.create_namespace("test")

    @namespace.register(name="valid")
    def test_func() -> None:
        pass

    @namespace.register(name="second")
    def second_func() -> None:
        pass

    return registry


@pytest.fixture
def run_storage() -> RunStorage:
    redis = redis_clusters.get("default")
    redis.flushdb()
    return RunStorage(redis)


def test_schedulerunner_add_invalid(taskregistry) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            {
                "task": "invalid",
                "schedule": timedelta(minutes=5),
            }
        )
    assert "Invalid task name" in str(err)

    with pytest.raises(KeyError) as key_err:
        schedule_set.add(
            {
                "task": "test:invalid",
                "schedule": timedelta(minutes=5),
            }
        )
    assert "No task registered" in str(key_err)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            {
                "task": "test:valid",
                "schedule": timedelta(microseconds=99),
            }
        )
    assert "microseconds" in str(err)


def test_schedulerunner_tick_no_tasks(taskregistry: TaskRegistry, run_storage: RunStorage) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 60


def test_schedulerunner_tick_one_task_time_remaining(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)

    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )
    # Last run was two minutes ago.
    with freeze_time("2025-01-24 14:23:00"):
        run_storage.set("test:valid", datetime(2025, 1, 24, 14, 28, 0, tzinfo=UTC))

    namespace = taskregistry.get("test")
    with freeze_time("2025-01-24 14:25:00"), patch.object(namespace, "send_task") as mock_send:
        sleep_time = schedule_set.tick()
        assert sleep_time == 180
        assert mock_send.call_count == 0

    last_run = run_storage.read("test:valid")
    assert last_run == datetime(2025, 1, 24, 14, 23, 0, tzinfo=UTC)


def test_schedulerunner_tick_one_task_spawned(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )

    # Last run was 5 minutes from the freeze_time below
    run_storage.read_many.return_value = {
        "test:valid": datetime(2025, 1, 24, 14, 19, 55),
    }
    run_storage.set.return_value = True

    namespace = taskregistry.get("test")
    with freeze_time("2025-01-24 14:25:00"), patch.object(namespace, "send_task") as mock_send:
        sleep_time = schedule_set.tick()
        assert sleep_time == 300
        assert mock_send.call_count == 1

    assert run_storage.set.call_count == 1
    # set() is called with the correct next_run time
    run_storage.set.assert_called_with("test:valid", datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC))


def test_schedulerunner_tick_key_exists_no_spawn(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )

    namespace = taskregistry.get("test")
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
    # last_run time should synchronize with run_storage state, and count down from 14:30
    with freeze_time("2025-01-24 14:30:02"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 298
        assert mock_send.call_count == 1


def test_schedulerunner_tick_one_task_multiple_ticks(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
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


def test_schedulerunner_tick_one_task_multiple_ticks_crontab(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": crontab(minute="*/2"),
        }
    )

    namespace = taskregistry.get("test")
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


def test_schedulerunner_tick_multiple_tasks(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )
    schedule_set.add(
        {
            "task": "test:second",
            "schedule": timedelta(minutes=2),
        }
    )

    namespace = taskregistry.get("test")
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


def test_schedulerunner_tick_fast_and_slow(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleRunner(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(seconds=30),
        }
    )
    schedule_set.add(
        {
            "task": "test:second",
            "schedule": crontab(minute="*/2"),
        }
    )

    namespace = taskregistry.get("test")
    with patch.object(namespace, "send_task") as mock_send:
        with freeze_time("2025-01-24 14:25:00"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["second", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:25:30"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["second", "valid", "valid"]

        run_storage.delete("test:valid")
        run_storage.delete("test:second")
        with freeze_time("2025-01-24 14:26:01"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["second", "valid", "valid", "second", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:26:31"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        called = extract_sent_tasks(mock_send)
        assert called == ["second", "valid", "valid", "second", "valid", "valid"]

        run_storage.delete("test:valid")
        with freeze_time("2025-01-24 14:27:01"):
            sleep_time = schedule_set.tick()
            assert sleep_time == 30

        assert run_storage.read("test:valid")
        called = extract_sent_tasks(mock_send)
        assert called == [
            "second",
            "valid",
            "valid",
            "second",
            "valid",
            "valid",
            "valid",
        ]


def extract_sent_tasks(mock: Mock) -> list[str]:
    return [call[0][0].taskname for call in mock.call_args_list]
