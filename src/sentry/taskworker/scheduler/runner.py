from __future__ import annotations

import heapq
import logging
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from django.utils import timezone
from redis.client import StrictRedis
from rediscluster import RedisCluster
from sentry_sdk import capture_exception
from sentry_sdk.crons import MonitorStatus, capture_checkin

from sentry.conf.types.taskworker import ScheduleConfig, crontab
from sentry.taskworker.app import TaskworkerApp
from sentry.taskworker.scheduler.schedules import CrontabSchedule, Schedule, TimedeltaSchedule
from sentry.taskworker.task import Task
from sentry.utils import metrics

logger = logging.getLogger("taskworker.scheduler")

if TYPE_CHECKING:
    from sentry_sdk._types import MonitorConfig


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
        # next_runtime & now could be the same second, and redis gets sad if ex=0
        duration = max(int((next_runtime - now).total_seconds()), 1)

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

        metrics.incr("taskworker.scheduler.run_storage.read.miss", tags={"taskname": taskname})
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

    def __init__(self, *, key: str, task: Task[Any, Any], schedule: timedelta | crontab) -> None:
        self._key = key
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

        return f"<ScheduleEntry key={self._key} fullname={self.fullname} last_run={last_run} remaining_seconds={remaining_seconds}>"

    @property
    def fullname(self) -> str:
        return self._task.fullname

    @property
    def namespace(self) -> str:
        return self._task.namespace.name

    @property
    def taskname(self) -> str:
        return self._task.name

    def set_last_run(self, last_run: datetime | None) -> None:
        self._last_run = last_run

    def is_due(self) -> bool:
        return self._schedule.is_due(self._last_run)

    def remaining_seconds(self) -> int:
        return self._schedule.remaining_seconds(self._last_run)

    def runtime_after(self, start: datetime) -> datetime:
        return self._schedule.runtime_after(start)

    def delay_task(self) -> None:
        monitor_config = self.monitor_config()
        headers: dict[str, Any] = {}
        if monitor_config:
            check_in_id = capture_checkin(
                monitor_slug=self._key,
                monitor_config=monitor_config,
                status=MonitorStatus.IN_PROGRESS,
            )
            headers = {
                "sentry-monitor-check-in-id": check_in_id,
                "sentry-monitor-slug": self._key,
            }

        # We don't need every task linked back to the scheduler trace
        headers["sentry-propagate-traces"] = False

        self._task.apply_async(headers=headers)

    def monitor_config(self) -> MonitorConfig | None:
        checkin_config: MonitorConfig = {
            "schedule": {},
            "timezone": timezone.get_current_timezone_name(),
        }
        if isinstance(self._schedule, CrontabSchedule):
            checkin_config["schedule"]["type"] = "crontab"
            checkin_config["schedule"]["value"] = self._schedule.monitor_value()
        elif isinstance(self._schedule, TimedeltaSchedule):
            (interval_value, interval_units) = self._schedule.monitor_interval()
            # Monitors does not support intervals less than 1 minute.
            if interval_units == "second":
                return None

            checkin_config["schedule"]["type"] = "interval"
            checkin_config["schedule"]["value"] = interval_value
            checkin_config["schedule"]["unit"] = interval_units

        return checkin_config


class ScheduleRunner:
    """
    A task scheduler that a command run process can use to spawn tasks
    based on their schedules.

    Contains a collection of ScheduleEntry objects which are composed
    using `ScheduleRunner.add()`. Once the scheduler is built, `tick()`
    is used in a while loop to spawn tasks and sleep.
    """

    def __init__(self, app: TaskworkerApp, run_storage: RunStorage) -> None:
        self._entries: list[ScheduleEntry] = []
        self._app = app
        self._run_storage = run_storage
        self._heap: list[tuple[int, ScheduleEntry]] = []

    def add(self, key: str, task_config: ScheduleConfig) -> None:
        """Add a scheduled task to the runner."""
        try:
            (namespace, taskname) = task_config["task"].split(":")
        except ValueError:
            raise ValueError("Invalid task name. Must be in the format namespace:taskname")

        task = self._app.taskregistry.get_task(namespace, taskname)
        entry = ScheduleEntry(key=key, task=task, schedule=task_config["schedule"])
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
            logger.warning("taskworker.scheduler.no_heap")
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

            logger.debug("taskworker.scheduler.delay_task", extra={"fullname": entry.fullname})
            metrics.incr(
                "taskworker.scheduler.delay_task",
                tags={
                    "taskname": entry.taskname,
                    "namespace": entry.namespace,
                },
                sample_rate=1.0,
            )
        else:
            run_state = self._run_storage.read(entry.fullname)
            entry.set_last_run(now)

            logger.info(
                "taskworker.scheduler.sync_with_storage",
                extra={
                    "taskname": entry.taskname,
                    "namespace": entry.namespace,
                    "last_runtime": run_state.isoformat() if run_state else None,
                },
            )
            metrics.incr(
                "taskworker.scheduler.sync_with_storage",
                tags={"taskname": entry.taskname, "namespace": entry.namespace},
            )

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
        logger.info(
            "taskworker.scheduler.load_last_run",
            extra={
                "entry_count": len(self._entries),
                "loaded_count": len(last_run_times),
            },
        )
