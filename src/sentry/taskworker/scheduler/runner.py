from __future__ import annotations

import heapq
import logging
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone
from redis.client import StrictRedis
from rediscluster import RedisCluster
from sentry_sdk import capture_exception

from sentry.conf.types.taskworker import ScheduleConfig, crontab
from sentry.taskworker.registry import TaskRegistry
from sentry.taskworker.scheduler.schedules import CrontabSchedule, Schedule, TimedeltaSchedule
from sentry.taskworker.task import Task
from sentry.utils import metrics

logger = logging.getLogger("taskworker.scheduler")


class RunStorage:
    """
    Storage interface for tracking the last run time of tasks.
    This is split out from `ScheduleRunner` to allow us to change storage
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


class ScheduleEntry:
    """An individual task that can be scheduled to be run."""

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

    def __repr__(self) -> str:
        last_run = self._last_run.isoformat() if self._last_run else None
        remaining_seconds = self.remaining_seconds()

        return f"<ScheduleEntry fullname={self.fullname} last_run={last_run} remaining_seconds={remaining_seconds}>"

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


class ScheduleRunner:
    """
    A task scheduler that a command run process can use to spawn tasks
    based on their schedules.

    Contains a collection of ScheduleEntry objects which are composed
    using `ScheduleRunner.add()`. Once the scheduler is built, `tick()`
    is used in a while loop to spawn tasks and sleep.
    """

    def __init__(self, registry: TaskRegistry, run_storage: RunStorage) -> None:
        self._entries: list[ScheduleEntry] = []
        self._registry = registry
        self._run_storage = run_storage
        self._heap: list[tuple[int, ScheduleEntry]] = []

    def add(self, task_config: ScheduleConfig) -> None:
        """Add a task to the runner."""
        try:
            (namespace, taskname) = task_config["task"].split(":")
        except ValueError:
            raise ValueError("Invalid task name. Must be in the format namespace:taskname")

        task = self._registry.get_task(namespace, taskname)
        entry = ScheduleEntry(task=task, schedule=task_config["schedule"])
        self._entries.append(entry)
        self._heap = []

    def log_startup(self) -> None:
        task_names = [entry.fullname for entry in self._entries]
        logger.info("taskworker.scheduler.startup", extra={"tasks": task_names})

    def tick(self) -> float:
        """
        Check if any tasks are due to run at current_time, and spawn them.

        Returns the number of seconds to sleep until the next task is due.
        """
        self._update_heap()

        if not self._heap:
            return 60

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

        return self._heap[0][0]

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

    def _update_heap(self) -> None:
        """update the heap to reflect current remaining time"""
        if not self._heap:
            self._load_last_run()

        heap_items = [(item.remaining_seconds(), item) for item in self._entries]
        heapq.heapify(heap_items)
        self._heap = heap_items

    def _load_last_run(self) -> None:
        """
        load last_run state from storage

        We synchronize each time the schedule set is modified and
        then incrementally as tasks spawn attempts are made.
        """
        last_run_times = self._run_storage.read_many([item.fullname for item in self._entries])
        for item in self._entries:
            last_run = last_run_times.get(item.fullname, None)
            item.set_last_run(last_run)
