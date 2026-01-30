from __future__ import annotations

import logging
import time

from sentry import options

logger = logging.getLogger(__name__)

MAX_ENTRIES = 1000
LOGGING_ENTRIES = 50
LOGGING_INTERVAL = 60  # seconds


class BufferLogger:
    """
    Tracks slow EVALSHA operations and logs the most problematic
    project/trace combinations.

    This logger keeps a bounded map (max 1000 entries) of project_and_trace keys
    to their occurrence counts and maximum latencies. When the configured latency
    threshold is exceeded, affected keys are recorded. Every 5 seconds, the top 50
    entries by count are logged at INFO level, then the tracked data is cleared.
    """

    def __init__(self) -> None:
        self._data: dict[str, tuple[int, float]] = {}
        self._last_log_time: float | None = None

    def log(self, entries: list[tuple[str, int]]) -> None:
        """
        Record a batch of EVALSHA operations and periodically log the top offenders.

        :param entries: List of tuples containing (project_and_trace, latency_ms) pairs.
        """
        if not entries:
            return

        threshold = options.get("spans.buffer.evalsha-latency-threshold")
        any_above_threshold = False

        for project_and_trace, latency_ms in entries:
            if len(self._data) >= MAX_ENTRIES:
                break

            if latency_ms <= threshold:
                continue

            any_above_threshold = True

            if not self._last_log_time:
                self._last_log_time = time.time()

            if project_and_trace in self._data:
                count, max_latency = self._data[project_and_trace]
                self._data[project_and_trace] = (count + 1, max(max_latency, latency_ms))
            else:
                self._data[project_and_trace] = (1, latency_ms)

        # Only check time if we have data or if we processed entries above threshold
        if not any_above_threshold and not self._last_log_time:
            return

        if time.time() - (self._last_log_time or 0.0) >= LOGGING_INTERVAL:
            if len(self._data) > LOGGING_ENTRIES:
                sorted_items = sorted(self._data.items(), key=lambda x: x[1][0], reverse=True)
            else:
                sorted_items = list(self._data.items())

            if len(sorted_items) > 0:
                entries_str = [
                    f"{key}:{count}:{max_latency}"
                    for key, (count, max_latency) in sorted_items[:50]
                ]

                logger.info(
                    "spans.buffer.slow_evalsha_operations",
                    extra={
                        "top_slow_operations": entries_str,
                        "num_tracked_keys": len(self._data),
                        "pruned_list": len(self._data) == MAX_ENTRIES,
                    },
                )
            self._data.clear()
            self._last_log_time = None
