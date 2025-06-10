import logging
import time
from collections import defaultdict
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from datetime import timedelta
from typing import Any


def top_n_slowest(durations: dict[str, float], n: int) -> dict[str, float]:
    if len(durations) <= n:
        return durations
    return dict(sorted(durations.items(), key=lambda x: x[1], reverse=True)[:n])


# To keep logs reasonable, we only report up to this many individual iteration times.
_MAX_ITERATIONS_LOGGED = 20


# NOTE: You should be using Sentry's built-in performance tracking instead of this.
# This is a manual fallback for when that isn't working for us.
class BatchPerformanceTracker:
    """
    A utility class for monitoring and logging the performance of batch processing operations to better
    understand where time is spent among the iterations when a batch takes too long.

    Example:
        tracker = BatchPerformanceTracker("my_package.process_items", logger, threshold=timedelta(seconds=10))
        for item in items:
            with tracker.track("process_single_item"):
                process_item(item)
        tracker.finalize()  # Logs if total time exceeds threshold
    """

    def __init__(
        self,
        name: str,
        logger: logging.Logger,
        threshold: timedelta,
        extra: Mapping[str, Any] | None = None,
        time_func: Callable[[], float] = time.time,
    ) -> None:
        """
        Initialize the tracker.

        Args:
            name: Event name to log.
            logger: The logger to use for performance reporting
            threshold: The time threshold that triggers detailed logging
            extra: Extra values to include in the log message extras.
            time_func: The function to use for timing. Defaults to time.time.
        """
        self._name = name
        self._logger = logger
        self._threshold = threshold
        self._time_func = time_func
        self._failure_key: str | None = None
        self._extra: Mapping[str, Any] = extra or {}
        # even if keys are duplicated, we want to track total duration accurately.
        self._iteration_durations: defaultdict[str, float] = defaultdict(float)

    @contextmanager
    def track(self, key: str) -> Generator[None]:
        """
        Context manager to track the duration of a single iteration.
        Args:
            key: A unique identifier for this iteration (e.g., item ID or operation name)
        """
        start_time = self._time_func()
        try:
            yield
        except Exception:
            self._failure_key = key
            raise
        finally:
            duration = self._time_func() - start_time
            self._iteration_durations[key] += duration

    def finalize(self) -> None:
        """
        Log detailed performance metrics if the total processing time exceeds the threshold.
        This helps identify if performance issues are caused by a few slow items or
        consistent slowness across all items.
        """
        if not self._iteration_durations:
            return
        cumulative_duration = sum(self._iteration_durations.values())
        if cumulative_duration >= self._threshold.total_seconds():
            extra: dict[str, Any] = {
                "total_duration": cumulative_duration,
                "durations": top_n_slowest(self._iteration_durations, _MAX_ITERATIONS_LOGGED),
                **self._extra,
            }
            if self._failure_key:
                extra["failure_key"] = self._failure_key
            durations_truncated = max(0, len(self._iteration_durations) - _MAX_ITERATIONS_LOGGED)
            if durations_truncated > 0:
                extra["durations_truncated"] = durations_truncated
            self._logger.info(
                self._name,
                extra=extra,
            )


@contextmanager
def track_batch_performance(
    name: str, logger: logging.Logger, threshold: timedelta, extra: Mapping[str, Any] | None = None
) -> Generator[BatchPerformanceTracker]:
    """Context manager that yields a BatchPerformanceTracker for monitoring batch operation performance
    and ensures that it is reliably finalized.

    Args:
        name: Log event name, eg "my_package.my_function.process_batch_loop".
        logger: Logger for performance reporting
        threshold: Time threshold where per iteration performance is logged.
        extra: Extra values to include in the log message extras.

    Example:
        with track_batch_performance("process_items.loop", logger, timedelta(seconds=10)) as tracker:
            for item in items:
                with tracker.track(f"item_{item.id}"):
                    process_item(item)
    """
    tracker = BatchPerformanceTracker(name, logger, threshold, extra)
    try:
        yield tracker
    finally:
        tracker.finalize()


@contextmanager
def log_if_slow(
    logger: logging.Logger,
    name: str,
    extra: Mapping[str, Any],
    *,
    threshold_seconds: float,
) -> Generator[None]:
    """
    Context manager that logs a message if the block takes longer than the threshold.
    """
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        if duration >= threshold_seconds:
            logger.info(name, extra=extra)
