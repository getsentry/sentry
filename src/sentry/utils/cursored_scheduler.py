"""
A general-purpose framework for processing large querysets in batches,
spread over time via a scheduled task.

The framework takes a queryset, a task, a cycle duration, and a schedule key.
It reads the tick interval from the schedule config, then automatically
calculates the batch size needed to complete one full cycle within the target
duration. Each invocation, it fetches the next batch of PKs and dispatches
the task for each one. The cursor is stored in cache (Redis) so progress
persists across invocations. A distributed lock prevents overlapping ticks.

Usage:

    from datetime import timedelta
    from sentry.utils.cursored_scheduler import CursoredScheduler

    # my_module/tasks.py
    scheduler = CursoredScheduler(
        name="my_sync",
        schedule_key="my-sync-beat",
        queryset=MyModel.objects.filter(status=ACTIVE),
        task=process_item,
        cycle_duration=timedelta(hours=6),
    )

    @instrumented_task(name="sentry.my_module.tasks.my_sync_beat", ...)
    def my_sync_beat():
        scheduler.tick()

    # server.py — TASKWORKER_SCHEDULES
    "my-sync-beat": {
        "task": "namespace:sentry.my_module.tasks.my_sync_beat",
        "schedule": timedelta(minutes=1),  # must be timedelta, not crontab
    },

The task will be called with the PK as a positional argument:
    process_item.delay(item_pk)
"""

from __future__ import annotations

import logging
import math
import time
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Model, QuerySet
from taskbroker_client.task import Task

from sentry.locks import locks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

CURSOR_CACHE_KEY_PREFIX = "cursored_scheduler"
BATCH_SIZE_CACHE_KEY_PREFIX = "cursored_scheduler_batch_size"
CYCLE_START_CACHE_KEY_PREFIX = "cursored_scheduler_cycle_start"
LOCK_PREFIX = "cursored_scheduler_lock"
# How long to hold the lock during a tick
DEFAULT_LOCK_DURATION_SECONDS = 120
# Minimum batch size
MIN_BATCH_SIZE = 1


def _get_tick_interval(schedule_key: str) -> timedelta:
    """
    Read the tick interval from TASKWORKER_SCHEDULES for the given key.
    Requires the schedule to be a timedelta, not a crontab.
    """
    schedules = getattr(settings, "TASKWORKER_SCHEDULES", {})
    if schedule_key not in schedules:
        raise ValueError(
            f"Schedule key '{schedule_key}' not found in TASKWORKER_SCHEDULES. "
            f"Register it in server.py before creating a CursoredScheduler."
        )

    schedule = schedules[schedule_key].get("schedule")
    if not isinstance(schedule, timedelta):
        raise TypeError(
            f"CursoredScheduler requires a timedelta schedule, "
            f"but '{schedule_key}' uses {type(schedule).__name__}. "
            f"Change the schedule in server.py to use timedelta instead of crontab."
        )

    return schedule


class CursoredScheduler[M: Model]:
    """
    Processes a queryset in batches over multiple scheduled task invocations.

    Each call to tick() acquires a lock, fetches the next batch of rows by PK,
    dispatches the configured task for each row's PK, and advances the cursor.
    When all rows have been processed, the cursor resets and a new cycle
    begins on the next tick().

    Batch size is auto-calculated at the start of each cycle based on the total
    row count, cycle_duration, and the tick interval from the schedule config,
    so that one full pass through the queryset completes within approximately
    cycle_duration.
    """

    def __init__(
        self,
        name: str,
        schedule_key: str,
        queryset: QuerySet[M],
        task: Task[[int], None],
        cycle_duration: timedelta,
        lock_duration: int = DEFAULT_LOCK_DURATION_SECONDS,
    ):
        self.name = name
        self.schedule_key = schedule_key
        self.cache_key = f"{CURSOR_CACHE_KEY_PREFIX}:{name}"
        self.batch_size_cache_key = f"{BATCH_SIZE_CACHE_KEY_PREFIX}:{name}"
        self.cycle_start_cache_key = f"{CYCLE_START_CACHE_KEY_PREFIX}:{name}"
        self.lock_key = f"{LOCK_PREFIX}:{name}"
        self.queryset = queryset
        self.task = task
        self.cycle_duration = cycle_duration
        self.cache_ttl = int(cycle_duration.total_seconds() * 2)
        self.lock_duration = lock_duration
        self._metric_tags = {"scheduler": name}

    @property
    def tick_interval(self) -> timedelta:
        return _get_tick_interval(self.schedule_key)

    def tick(self) -> bool:
        """
        Process the next batch. Call this from your beat task.

        Acquires a lock to prevent overlapping ticks, fetches the next batch
        of PKs from the queryset, dispatches the task for each one, and
        advances the cursor.

        Returns True if there are more items to process, False if the cycle
        is complete. Returns False without processing if the lock cannot be
        acquired.
        """
        lock = locks.get(
            key=self.lock_key,
            duration=self.lock_duration,
            name=self.name,
        )

        try:
            with lock.acquire():
                return self._process_batch()
        except UnableToAcquireLock:
            metrics.incr("cursored_scheduler.lock_contention", tags=self._metric_tags)
            logger.info(
                "cursored_scheduler.lock_contention",
                extra={"scheduler": self.name},
            )
            return False

    def _process_batch(self) -> bool:
        tick_start = time.time()

        cursor = self._get_cursor()
        queryset = self.queryset

        if cursor == 0:
            batch_size = self._initialize_batch(queryset)
        else:
            batch_size = self._get_batch_size()

        items = list(
            queryset.filter(pk__gt=cursor).order_by("pk").values_list("pk", flat=True)[:batch_size]
        )

        if not items:
            self._finalize_batch()
            metrics.timing(
                "cursored_scheduler.tick_duration", time.time() - tick_start, tags=self._metric_tags
            )
            return False

        for pk in items:
            self.task.delay(pk)

        dispatched = len(items)
        metrics.gauge("cursored_scheduler.batch_size", dispatched, tags=self._metric_tags)

        self._set_cursor(items[-1])

        metrics.timing(
            "cursored_scheduler.tick_duration", time.time() - tick_start, tags=self._metric_tags
        )

        if dispatched < batch_size:
            self._finalize_batch()
            return False

        return True

    def _initialize_batch(self, queryset: QuerySet[M]) -> int:
        batch_size = self._calculate_batch_size(queryset)
        cache.set(self.batch_size_cache_key, batch_size, self.cache_ttl)
        cache.set(self.cycle_start_cache_key, time.time(), self.cache_ttl)
        return batch_size

    def _finalize_batch(self):
        """Reset cursor and batch size to 0, starting a new cycle on the next tick."""
        self._emit_cycle_duration()
        cache.set(self.cache_key, 0, self.cache_ttl)
        cache.set(self.batch_size_cache_key, 0, self.cache_ttl)
        cache.delete(self.cycle_start_cache_key)
        metrics.incr("cursored_scheduler.cycle_complete", tags=self._metric_tags)

    def _calculate_batch_size(self, queryset: QuerySet[M]) -> int:
        """
        Calculate batch size based on total rows, cycle duration, and tick interval.

        batch_size = ceil(total_rows / ticks_per_cycle)
        """
        total_rows = queryset.count()
        ticks_per_cycle = self.cycle_duration / self.tick_interval
        batch_size = math.ceil(total_rows / ticks_per_cycle)
        return max(batch_size, MIN_BATCH_SIZE)

    def _emit_cycle_duration(self) -> None:
        """Emit timing metrics for the completed cycle."""
        cycle_start = cache.get(self.cycle_start_cache_key)
        if cycle_start is None:
            return

        elapsed_seconds = time.time() - float(cycle_start)
        target_seconds = self.cycle_duration.total_seconds()
        drift_seconds = elapsed_seconds - target_seconds

        metrics.timing("cursored_scheduler.cycle_duration", elapsed_seconds, tags=self._metric_tags)
        metrics.timing("cursored_scheduler.cycle_drift", drift_seconds, tags=self._metric_tags)

    def _get_cursor(self) -> int:
        value = cache.get(self.cache_key)
        if value is None:
            return 0
        return int(value)

    def _set_cursor(self, cursor: int) -> None:
        cache.set(self.cache_key, cursor, self.cache_ttl)

    def _get_batch_size(self) -> int:
        value = cache.get(self.batch_size_cache_key)
        if value is None:
            return 0
        return int(value)
