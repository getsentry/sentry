from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest
from django.utils import timezone

from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.scheduler import RedisRunStorage, RunStorage, ScheduleSet, TimedeltaSchedule
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.redis import redis_clusters


def test_timedeltaschedule_invalid() -> None:
    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(microseconds=5))

    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(seconds=-1))


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_is_due() -> None:
    now = timezone.now()
    delta = timedelta(minutes=5)
    schedule = TimedeltaSchedule(delta)

    assert not schedule.is_due(now)

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert not schedule.is_due(four_min_ago)

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.is_due(five_min_ago)

    six_min_ago = now - timedelta(minutes=6)
    assert schedule.is_due(six_min_ago)


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_remaining_delta() -> None:
    now = timezone.now()
    delta = timedelta(minutes=5)
    schedule = TimedeltaSchedule(delta)

    assert schedule.remaining_delta(None).total_seconds() == 0
    assert schedule.remaining_delta(now).total_seconds() == 300

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert schedule.remaining_delta(four_min_ago).total_seconds() == 1

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.remaining_delta(five_min_ago).total_seconds() == 0

    ten_min_ago = now - timedelta(minutes=10)
    assert schedule.remaining_delta(ten_min_ago).total_seconds() == 0


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


def test_scheduleset_add_invalid(taskregistry) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            {
                "task": "invalid",
                "schedule": timedelta(minutes=5),
            }
        )
    assert "Invalid task name" in str(err)

    with pytest.raises(KeyError) as err:
        schedule_set.add(
            {
                "task": "test:invalid",
                "schedule": timedelta(minutes=5),
            }
        )
    assert "No task registered" in str(err)

    with pytest.raises(ValueError) as err:
        schedule_set.add(
            {
                "task": "test:valid",
                "schedule": timedelta(microseconds=99),
            }
        )
    assert "microseconds" in str(err)


def test_scheduleset_tick_one_task_time_remaining(taskregistry) -> None:
    run_storage = Mock(spec=RunStorage)
    # Last run is two minutes from 'now'
    run_storage.read.return_value = datetime(2025, 1, 24, 14, 23, 0)
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)

    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 180

    assert run_storage.set.call_count == 0


def test_scheduleset_tick_one_task_spawned(taskregistry) -> None:
    run_storage = Mock(spec=RunStorage)
    # Last run was 5 min, 5 sec ago
    run_storage.read.return_value = datetime(2025, 1, 24, 14, 19, 55)
    run_storage.set.return_value = True

    namespace = taskregistry.get("test")
    namespace.send_task = Mock()

    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)
    schedule_set.add(
        {
            "task": "test:valid",
            "schedule": timedelta(minutes=5),
        }
    )

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 300

    assert run_storage.set.call_count == 1
    assert namespace.send_task.call_count == 1
    run_storage.set.assert_called_with("test:valid", datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC))


def test_scheduleset_tick_one_task_multiple_ticks(taskregistry) -> None:
    redis = redis_clusters.get("default")
    redis.flushdb()
    run_storage = RedisRunStorage(redis)

    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)
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


def test_scheduleset_tick_multiple_tasks(taskregistry) -> None:
    redis = redis_clusters.get("default")
    redis.flushdb()

    namespace = taskregistry.get("test")
    namespace.send_task = Mock()

    run_storage = RedisRunStorage(redis)
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)
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

    with freeze_time("2025-01-24 14:25:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 120

    assert namespace.send_task.call_count == 2

    with freeze_time("2025-01-24 14:26:00"):
        sleep_time = schedule_set.tick()
        assert sleep_time == 60

    assert namespace.send_task.call_count == 2

    # Remove the redis key, as the ttl in redis doesn't respect freeze_time()
    run_storage.delete("test:second")
    with freeze_time("2025-01-24 14:27:01"):
        sleep_time = schedule_set.tick()
        # two minutes left on the 5 min task
        assert sleep_time == 120

    assert namespace.send_task.call_count == 3
