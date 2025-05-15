import logging
import time
from collections import defaultdict
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import timedelta
from typing import Any


def top_n_slowest(durations: dict[str, float], n: int) -> dict[str, float]:
    if len(durations) <= n:
        return durations
    return dict(sorted(durations.items(), key=lambda x: x[1], reverse=True)[:n])


# To keep logs reasonable, we only report up to this many individual iteration times.
_MAX_ITERATIONS_LOGGED = 200


# NOTE: You should be using Sentry's built-in performance tracking instead of this.
# This is a manual fallback for when that isn't working for us.
class BatchPerformanceTracker:
    """
    A utility class for monitoring and logging the performance of batch processing operations to better
    understand where time is spent among the iterations when a batch takes too long.
    If an exception is raised, it will be logged if the total processing time exceeds the threshold
    even if finalize is not called.

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
        time_func: Callable[[], float] = time.time,
    ) -> None:
        """
        Initialize the tracker.

        Args:
            name: A descriptive name for the batch operation being tracked
            logger: The logger to use for performance reporting
            total_threshold: The time threshold that triggers detailed logging
            time_func: The function to use for timing. Defaults to time.time.
        """
        self.name = name
        self.logger = logger
        self.threshold = threshold
        self.time_func = time_func
        # even if keys are duplicated, we want to track total duration accurately.
        self.iteration_durations: defaultdict[str, float] = defaultdict(float)

    def _generate_extra(self) -> dict[str, Any]:
        """
        Generate the extra data to log from iteration durations.
        """
        extra = {
            "name": self.name,
            "total_duration": sum(self.iteration_durations.values()),
            "durations": top_n_slowest(self.iteration_durations, _MAX_ITERATIONS_LOGGED),
        }
        if len(self.iteration_durations) > _MAX_ITERATIONS_LOGGED:
            extra["durations_truncated"] = True
        return extra

    @contextmanager
    def track(self, key: str) -> Generator[None]:
        """
        Context manager to track the duration of a single iteration.
        If an exception is raised, it will be logged if the total processing time exceeds the threshold
        and the exception will be re-raised.

        Args:
            key: A unique identifier for this iteration (e.g., item ID or operation name)
        """
        start_time = self.time_func()
        stored = False
        try:
            yield
        except Exception as e:
            duration = self.time_func() - start_time
            self.iteration_durations[key] += duration
            stored = True
            if duration >= self.threshold.total_seconds():
                self.logger.exception(
                    e,
                    extra=self._generate_extra(),
                )
            raise
        finally:
            if not stored:
                duration = self.time_func() - start_time
                self.iteration_durations[key] += duration

    def finalize(self) -> None:
        """
        Log detailed performance metrics if the total processing time exceeds the threshold.
        This helps identify if performance issues are caused by a few slow items or
        consistent slowness across all items.
        """
        if not self.iteration_durations:
            return
        cumulative_duration = sum(self.iteration_durations.values())
        if cumulative_duration >= self.threshold.total_seconds():
            self.logger.info(
                f"{self.name} took {cumulative_duration} seconds to complete",
                extra=self._generate_extra(),
            )


@contextmanager
def track_batch_performance(
    name: str, logger: logging.Logger, threshold: timedelta
) -> Generator[BatchPerformanceTracker]:
    """Context manager that yields a BatchPerformanceTracker for monitoring batch operation performance.

    Args:
        name: Log event name, eg "my_package.my_function.process_batch_loop".
        logger: Logger for performance reporting
        total_threshold: Time threshold where per iteration performance is logged.
    """
    tracker = BatchPerformanceTracker(name, logger, threshold)
    try:
        yield tracker
    finally:
        tracker.finalize()
