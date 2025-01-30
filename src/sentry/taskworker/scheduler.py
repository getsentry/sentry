from __future__ import annotations

import abc
import dataclasses
import heapq
import logging
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, TypedDict

from cronsim import CronSim, CronSimError
from django.utils import timezone
from redis.client import StrictRedis
from rediscluster import RedisCluster
from sentry_sdk import capture_exception

from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.task import Task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class ScheduleConfig(TypedDict):
    """The schedule definition for an individual task."""

    task: str
    schedule: timedelta | crontab


ScheduleConfigMap = Mapping[str, ScheduleConfig]
"""A collection of schedule configuration, usually defined in application configuration"""


class RunStorage:
    """
    Storage interface for tracking the last run time of tasks.
    This is split out from `ScheduleSet` to allow us to change storage
    in the future, or adapt taskworkers for other applications should we need to.
    """

    def __init__(self, redis: RedisCluster[str] | StrictRedis[str]) -> None:
        self._redis = redis

    def _make_key(self, taskname: str) -> str:
        return f"tw:scheduler:{taskname}"

    def set(self, taskname: str, next_runtime: datetime) -> bool:
        """
        Record a spawn time for a task.
        The next_runtime parameter indicates when the record should expire,
        and a task can be spawned again.

        Returns False when the key is set and a task should not be spawned.
        """
        now = timezone.now()
        duration = next_runtime - now

        result = self._redis.set(self._make_key(taskname), now.isoformat(), ex=duration, nx=True)
        return bool(result)

    def read(self, taskname: str) -> datetime | None:
        """
        Retrieve the last run time of a task
        Returns None if last run time has expired or is unknown.
        """
        result = self._redis.get(self._make_key(taskname))
        if result:
            return datetime.fromisoformat(result)
        return None

    def read_many(self, tasknames: list[str]) -> Mapping[str, datetime | None]:
        """
        Retreive last run times in bulk
        """
        values = self._redis.mget([self._make_key(taskname) for taskname in tasknames])
        run_times = {
            taskname: datetime.fromisoformat(value) if value else None
            for taskname, value in zip(tasknames, values)
        }
        return run_times

    def delete(self, taskname: str) -> None:
        """remove a task key - mostly for testing."""
        self._redis.delete(self._make_key(taskname))


class Schedule(metaclass=abc.ABCMeta):
    """Interface for scheduling tasks to run at specific times."""

    @abc.abstractmethod
    def is_due(self, last_run: datetime | None = None) -> bool:
        """
        Check if the schedule is due to run again based on last_run.
        """

    @abc.abstractmethod
    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """
        Get the remaining seconds until the schedule should run again.
        """

    @abc.abstractmethod
    def runtime_after(self, start: datetime) -> datetime:
        """
        Get the next scheduled time after `start`
        """


class TimedeltaSchedule(Schedule):
    """Task schedules defined as `datetime.timedelta` intervals"""

    def __init__(self, delta: timedelta) -> None:
        self._delta = delta
        if delta.microseconds:
            raise ValueError("microseconds are not supported")
        if delta.total_seconds() < 0:
            raise ValueError("interval must be at least one second")

    def is_due(self, last_run: datetime | None = None) -> bool:
        """Check if the schedule is due to run again based on last_run."""
        if last_run is None:
            return True
        remaining = self.remaining_seconds(last_run)
        return remaining <= 0

    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """The number of seconds remaining until the next task should spawn"""
        if last_run is None:
            return 0
        # floor to timestamp as microseconds are not relevant
        now = int(timezone.now().timestamp())
        last_run_ts = int(last_run.timestamp())

        seconds_remaining = self._delta.total_seconds() - (now - last_run_ts)
        return max(int(seconds_remaining), 0)

    def runtime_after(self, start: datetime) -> datetime:
        """Get the next time a task should run after start"""
        return start + self._delta


@dataclasses.dataclass
class crontab:
    """
    crontab schedule value object

    Used in configuration to define a task schedule.
    """

    minute: str = "*"
    hour: str = "*"
    day_of_week: str = "*"
    day_of_month: str = "*"
    month_of_year: str = "*"

    def __str__(self) -> str:
        return (
            f"{self.minute} {self.hour} {self.day_of_month} {self.month_of_year} {self.day_of_week}"
        )


class CrontabSchedule(Schedule):
    """
    Task schedules defined as crontab expressions.

    Last run state is used to determine the next scheduled time.

    If last run is in the future, the future value will be used to
    calculate the next scheduled time.

    If runs are missed, the schedule will align to the next interval
    that would be scheduled. Lost runs are not recovered.
    """

    def __init__(self, name: str, crontab: crontab) -> None:
        self._crontab = crontab
        self._name = name
        try:
            self._cronsim = CronSim(str(crontab), timezone.now())
        except CronSimError as e:
            raise ValueError(f"crontab expression {self._crontab} is invalid") from e

    def is_due(self, last_run: datetime | None = None) -> bool:
        """Check if the schedule is due to run again based on last_run."""
        if last_run is None:
            return True
        remaining = self.remaining_seconds(last_run)
        return remaining <= 0

    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """
        Get the number of seconds until this schedule is due again

        Use the current time to find the next schedule time
        """
        if last_run is None:
            return 0

        # This could result in missed beats, or increased load on redis.
        last_run = last_run.replace(second=0, microsecond=0)
        now = timezone.now().replace(second=0, microsecond=0)

        # A future last_run means we should wait until the
        # next scheduled time, and then we can try again.
        # we could be competing with another scheduler, or
        # missing beats.
        if last_run > now:
            logger.warning(
                "taskworker.scheduler.future_value",
                extra={
                    "task": self._name,
                    "last_run": last_run,
                    "now": now,
                },
            )
            next_run = self._advance(last_run + timedelta(minutes=1))
            return int(next_run.timestamp() - now.timestamp())

        # If last run is in the past, see if the next runtime
        # is in the future.
        if last_run < now:
            next_run = self._advance(last_run)
            # Our next runtime is in the future, or now
            if next_run >= now:
                return int(next_run.timestamp() - now.timestamp())

            # still in the past, we missed an interval :(
            next_run = self._advance(now)
            logger.warning(
                "taskworker.scheduler.missed_interval",
                extra={
                    "task": self._name,
                    "last_run": last_run,
                    "now": now,
                    "next_run": next_run,
                },
            )
            return int(next_run.timestamp() - now.timestamp())

        # last_run == now, we are on the beat, find the next interval
        next_run = self._advance(now + timedelta(minutes=1))

        return int(next_run.timestamp() - now.timestamp())

    def _advance(self, dt: datetime) -> datetime:
        self._cronsim.dt = dt
        self._cronsim.advance()
        return self._cronsim.dt

    def runtime_after(self, start: datetime) -> datetime:
        """Get the next time a task should be spawned after `start`"""
        start = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
        return self._advance(start)


class ScheduleEntry:
    """Metadata about a task that can be scheduled"""

    def __init__(self, *, task: Task[Any, Any], schedule: timedelta | crontab) -> None:
        self._task = task
        scheduler: Schedule
        if isinstance(schedule, crontab):
            scheduler = CrontabSchedule(task.fullname, schedule)
        else:
            scheduler = TimedeltaSchedule(schedule)
        self._schedule = scheduler
        self._last_run: datetime | None = None

    def __lt__(self, other: ScheduleEntry) -> bool:
        # Secondary sorting for heapq when remaining time is the same
        return self.fullname < other.fullname

    @property
    def fullname(self) -> str:
        return self._task.fullname

    def set_last_run(self, last_run: datetime | None) -> None:
        self._last_run = last_run

    def is_due(self) -> bool:
        return self._schedule.is_due(self._last_run)

    def remaining_seconds(self) -> int:
        return self._schedule.remaining_seconds(self._last_run)

    def runtime_after(self, start: datetime) -> datetime:
        return self._schedule.runtime_after(start)

    def delay_task(self) -> None:
        logger.info("taskworker.scheduler.delay_task", extra={"task": self._task.fullname})
        self._task.delay()


class ScheduleSet:
    """
    A task scheduler that a command run process can use to spawn tasks
    based on their schedules.

    Contains a collection of ScheduleEntry objects which are composed
    using `ScheduleSet.add()`. Once the scheduler is built, `tick()`
    is used in a while loop to spawn tasks and sleep.
    """

    def __init__(self, registry: TaskRegistry, run_storage: RunStorage) -> None:
        self._entries: list[ScheduleEntry] = []
        self._registry = registry
        self._run_storage = run_storage
        self._heap: list[tuple[int, ScheduleEntry]] = []

    def add(self, task_config: ScheduleConfig) -> None:
        """Add a task to the scheduleset."""
        try:
            (namespace, taskname) = task_config["task"].split(":")
        except ValueError:
            raise ValueError("Invalid task name. Must be in the format namespace:taskname")

        task = self._registry.get_task(namespace, taskname)
        entry = ScheduleEntry(task=task, schedule=task_config["schedule"])
        self._entries.append(entry)
        self._heap = []

    def tick(self) -> float:
        """
        Check if any tasks are due to run at current_time, and spawn them.

        Returns the number of seconds to sleep until the next task is due.
        """
        self._build_heap()

        while True:
            # Peek at the top, and if it is due, pop, spawn and update last run time
            _, entry = self._heap[0]
            if entry.is_due():
                heapq.heappop(self._heap)
                try:
                    self._try_spawn(entry)
                except Exception as e:
                    # Trap errors from spawning/update state so that the heap stays consistent.
                    capture_exception(e)
                heapq.heappush(self._heap, (entry.remaining_seconds(), entry))
                continue
            else:
                # The top of the heap isn't ready, break for sleep
                break

        return entry.remaining_seconds()

    def _try_spawn(self, entry: ScheduleEntry) -> None:
        now = timezone.now()
        next_runtime = entry.runtime_after(now)
        if self._run_storage.set(entry.fullname, next_runtime):
            entry.delay_task()
            entry.set_last_run(now)

            logger.info("taskworker.scheduler.delay_task", extra={"task": entry.fullname})
            metrics.incr("taskworker.scheduler.delay_task")
        else:
            # sync with last_run state in storage
            entry.set_last_run(self._run_storage.read(entry.fullname))

            logger.info("taskworker.scheduler.sync_with_storage", extra={"task": entry.fullname})
            metrics.incr("taskworker.scheduler.sync_with_storage")

    def _build_heap(self) -> None:
        if self._heap:
            return

        heap_items = []
        last_run_times = self._run_storage.read_many([item.fullname for item in self._entries])
        for item in self._entries:
            last_run = last_run_times.get(item.fullname, None)
            item.set_last_run(last_run)
            remaining_time = item.remaining_seconds()
            heap_items.append((remaining_time, item))

        heapq.heapify(heap_items)
        self._heap = heap_items
