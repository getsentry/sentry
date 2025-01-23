from __future__ import annotations

import abc
import dataclasses
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, NotRequired, TypedDict

from django.utils import timezone
from rediscluster import RedisCluster

from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.task import Task


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


class ScheduleOptions(TypedDict):
    expires: timedelta | int


class ScheduleConfig(TypedDict):
    """The schedule definition for an individual task."""

    task: str
    schedule: timedelta | crontab
    options: NotRequired[ScheduleOptions]


ScheduleConfigMap = Mapping[str, ScheduleConfig]
"""A collection of schedule configuration, usually defined in application configuration"""


class RunStorage(metaclass=abc.ABCMeta):
    """Interface for storing task runtimes."""

    @abc.abstractmethod
    def set(self, taskname: str, next_runtime: datetime) -> None:
        """
        Record a spawn time for a task.
        The next_runtime parameter indicates when this task should run again.

        If a key is already set this method will raise an error.
        """

    @abc.abstractmethod
    def read(self, taskname: str) -> datetime | None:
        """
        Retrieve the last run time of a task
        Returns None if last run time has expired or is unknown.
        """


class RedisRunStorage(RunStorage):
    def __init__(self, cluster: RedisCluster) -> None:
        self._cluster = cluster

    def _make_key(self, taskname: str) -> str:
        return f"tw:scheduler:{taskname}"

    def set(self, taskname: str, next_runtime: datetime) -> None:
        now = timezone.now()
        duration = next_runtime - now

        result = self._cluster.set(self._make_key(taskname), now.isoformat(), ex=duration, nx=True)
        if not result:
            raise ValueError(f"Cannot set runtime for {taskname} it already has a runtime set")

    def read(self, taskname: str) -> datetime | None:
        result = self._cluster.get(self._make_key(taskname))
        if result:
            return datetime.fromisoformat(result.decode())
        return None


class Schedule(metaclass=abc.ABCMeta):
    """Interface for scheduling tasks to run at specific times."""

    @abc.abstractmethod
    def is_due(self, last_run: datetime | None = None) -> float:
        """
        Check if the schedule is due to run again based on last_run.
        """


class CrontabSchedule(Schedule):
    def __init__(self, crontab: crontab) -> None:
        self._crontab = crontab

    def is_due(self, last_run: datetime | None = None) -> bool:
        return False


class TimedeltaSchedule(Schedule):
    def __init__(self, delta: timedelta) -> None:
        self._delta = delta

    def is_due(self, last_run: datetime | None = None) -> bool:
        return False


class ScheduleEntry:
    """Metadata about a task that can be scheduled"""

    def __init__(
        self, *, task: Task[Any, Any], schedule: timedelta | crontab, options: ScheduleOptions
    ) -> None:
        self._task = task
        self._schedule = schedule
        self._options = options

    def is_due(self, last_run: datetime | None = None) -> bool:
        return False

    def delay_task(self) -> None:
        pass


class ScheduleSet:
    """A collection of ScheduleEntry objects"""

    def __init__(self, registry: TaskRegistry, run_storage: RunStorage) -> None:
        self._entries: list[ScheduleEntry] = []
        self._registry = registry
        self._run_storage = run_storage

    def add(self, task_config: ScheduleConfig) -> None:
        """Add a task to the schedule."""
        # Fetch task wrapper from registry/namespace
        # Build schedule entry, read last run time, add to collection

    def tick(self, current_time: datetime | None = None) -> float:
        """
        Check if any tasks are due to run at current_time, and spawn them.

        Returns the number of seconds to sleep until the next task is due.
        """
        # - put all the entries into a heap, or rebuild the heap?
        # - look at the top of the heap, if it has is_due() == true, spawn it
        #   if the top of the heap can't be spawned find out when it runs and return that
        #   duration in seconds
        # - before spawning the task, set last run time, and then spawn task

        return 0.0
