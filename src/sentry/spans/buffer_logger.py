"""
BufferLogger tracks and logs slow Redis pipeline operations in the spans buffer.

It maintains a count of project/trace combinations that exceed a configurable
latency threshold and periodically logs the most frequently occurring slow operations.
"""

from __future__ import annotations

import logging
import time

from sentry import options

logger = logging.getLogger(__name__)

MAX_ENTRIES = 1000
LOGGING_ENTRIES = 50
LOGGING_INTERVAL = 5  # seconds


class BufferLogger:
    """
    Tracks slow EVALSHA operations and logs the most problematic
    project/trace combinations.

    This logger keeps a bounded map (max 100 entries) of project_and_trace keys
    to their occurrence counts and maximum latencies. When the configured latency
    threshold is exceeded, affected keys are recorded. Every 5 seconds, the top 50
    entries by count are logged at INFO level, then the tracked data is cleared.
    """

    def __init__(self):
        self._data: dict[str, tuple[int, float]] = {}
        self._last_log_time = None

    def log(self, project_and_trace: str, latency_ms: int) -> None:
        """
        Record a single EVALSHA operation and periodically log the top offenders.
        """
        if len(self._data) >= MAX_ENTRIES:
            return

        threshold = options.get("spans.buffer.evalsha-latency-threshold")

        if latency_ms <= threshold:
            return

        if not self._last_log_time:
            self._last_log_time = time.time()

        # Update count and max latency for this project_and_trace
        if project_and_trace in self._data:
            count, max_latency = self._data[project_and_trace]
            self._data[project_and_trace] = (count + 1, max(max_latency, latency_ms))
        else:
            self._data[project_and_trace] = (1, latency_ms)

        if time.time() - self._last_log_time >= LOGGING_INTERVAL:
            if len(self._data) > LOGGING_ENTRIES:
                sorted_items = sorted(self._data.items(), key=lambda x: x[1][0], reverse=True)
            else:
                sorted_items = list(self._data.items())

            entries_str = [
                f"{key}:{count}:{max_latency}" for key, (count, max_latency) in sorted_items
            ]

            logger.info(
                "spans.buffer.slow_evalsha_operations",
                extra={
                    "top_slow_operations": entries_str,
                    "num_tracked_keys": len(self._data),
                },
            )
            self._data.clear()
            self._last_log_time = None
