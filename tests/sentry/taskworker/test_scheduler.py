from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from django.utils import timezone

from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.scheduler import (
    CrontabSchedule,
    RunStorage,
    ScheduleSet,
    TimedeltaSchedule,
    crontab,
)
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


def test_timedeltaschedule_invalid() -> None:
    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(microseconds=5))

    with pytest.raises(ValueError):
        TimedeltaSchedule(timedelta(seconds=-1))


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_is_due() -> None:
    now = timezone.now()
    schedule = TimedeltaSchedule(timedelta(minutes=5))

    assert not schedule.is_due(now)

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert not schedule.is_due(four_min_ago)

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.is_due(five_min_ago)

    six_min_ago = now - timedelta(minutes=6)
    assert schedule.is_due(six_min_ago)


@freeze_time("2025-01-24 14:25:00")
def test_timedeltaschedule_remaining_seconds() -> None:
    now = timezone.now()
    delta = timedelta(minutes=5)
    schedule = TimedeltaSchedule(delta)

    assert schedule.remaining_seconds(None) == 0
    assert schedule.remaining_seconds(now) == 300

    four_min_ago = now - timedelta(minutes=4, seconds=59)
    assert schedule.remaining_seconds(four_min_ago) == 1

    five_min_ago = now - timedelta(minutes=5)
    assert schedule.remaining_seconds(five_min_ago) == 0

    ten_min_ago = now - timedelta(minutes=10)
    assert schedule.remaining_seconds(ten_min_ago) == 0


def test_crontabschedule_invalid() -> None:
    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(hour="99"))

    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(hour="25"))

    with pytest.raises(ValueError):
        CrontabSchedule("test", crontab(day_of_week="25"))


def test_crontabschedule_is_due() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/5"))

    with freeze_time("2025-01-24 14:25:00"):
        now = timezone.now()
        assert schedule.is_due(None)
        assert not schedule.is_due(now)

    # last run was 14:20, current time is 14:22 = not due
    with freeze_time("2025-01-24 14:22:00"):
        two_twenty = timezone.now() - timedelta(minutes=2)
        assert not schedule.is_due(two_twenty)

    # last run was 14:20, current time is 14:25 = due
    with freeze_time("2025-01-24 14:25:00"):
        two_twenty = timezone.now() - timedelta(minutes=5)
        assert schedule.is_due(two_twenty)

    # last run was 14:15, current time is 14:25 = due as we missed an interval
    with freeze_time("2025-01-24 14:25:00"):
        two_fifteen = timezone.now() - timedelta(minutes=10)
        assert schedule.is_due(two_fifteen)

    # last run was 14:26 (the future) current time is 14:25 = not due
    with freeze_time("2025-01-24 14:25:00"):
        future = timezone.now() + timedelta(minutes=1)
        assert not schedule.is_due(future)


def test_crontabschedule_remaining_seconds() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/5"))

    assert schedule.remaining_seconds(None) == 0

    # last run was late (14:21), next spawn is at 14:25
    with freeze_time("2025-01-24 14:25:00"):
        four_min_ago = timezone.now() - timedelta(minutes=4)
        assert schedule.remaining_seconds(four_min_ago) == 0

    # last run was 5 min ago, right on schedule
    with freeze_time("2025-01-24 14:25:00"):
        five_min_ago = timezone.now() - timedelta(minutes=5)
        assert schedule.remaining_seconds(five_min_ago) == 0

    # last run was mere seconds ago. 5 min remaining
    with freeze_time("2025-01-24 14:25:10"):
        five_min_ago = timezone.now()
        assert schedule.remaining_seconds(five_min_ago) == 300

    with freeze_time("2025-01-24 14:25:59"):
        five_min_ago = timezone.now()
        assert schedule.remaining_seconds(five_min_ago) == 300

    # 14:19 was 1 min late, we missed a beat but we're currently on time.
    with freeze_time("2025-01-24 14:25:10"):
        six_min_ago = timezone.now() - timedelta(minutes=6)
        assert schedule.remaining_seconds(six_min_ago) == 0

    # We have missed a few intervals, try to get back on schedule for the next beat
    with freeze_time("2025-01-24 14:23:00"):
        twenty_two_min_ago = timezone.now() - timedelta(minutes=22)
        assert schedule.remaining_seconds(twenty_two_min_ago) == 120

    # We have encountered a value from the future.
    # Our clock could be wrong, or we competing with another scheduler.
    # Advance to the next tick 14:30.
    with freeze_time("2025-01-24 14:24:00"):
        future_two = timezone.now() + timedelta(minutes=2)
        assert schedule.remaining_seconds(future_two) == 360


@freeze_time("2025-01-24 14:25:00")
def test_crontabschedule_runtime_after() -> None:
    schedule = CrontabSchedule("test", crontab(minute="*/15"))

    now = timezone.now()
    assert schedule.runtime_after(now) == datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC)

    last_run = datetime(2025, 1, 24, 14, 29, 15, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 14, 30, 0, tzinfo=UTC)

    last_run = datetime(2025, 1, 24, 14, 38, 23, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 14, 45, 0, tzinfo=UTC)

    schedule = CrontabSchedule("test", crontab(minute="1", hour="*/6"))
    last_run = datetime(2025, 1, 24, 14, 29, 15, tzinfo=UTC)
    assert schedule.runtime_after(last_run) == datetime(2025, 1, 24, 18, 1, 0, tzinfo=UTC)

    schedule = CrontabSchedule("test", crontab(minute="*/1"))
    now = timezone.now()
    assert schedule.runtime_after(now) == datetime(2025, 1, 24, 14, 26, 0, tzinfo=UTC)


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


def test_scheduleset_tick_one_task_time_remaining(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)

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


def test_scheduleset_tick_one_task_spawned(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    run_storage = Mock(spec=RunStorage)
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)
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


def test_scheduleset_tick_key_exists_no_spawn(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
    schedule_set = ScheduleSet(registry=taskregistry, run_storage=run_storage)
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


def test_scheduleset_tick_one_task_multiple_ticks(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
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


def test_scheduleset_tick_multiple_tasks(
    taskregistry: TaskRegistry, run_storage: RunStorage
) -> None:
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
