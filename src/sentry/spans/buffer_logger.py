from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

MAX_ENTRIES = 1000
LOGGING_ENTRIES = 50
LOGGING_INTERVAL = 60  # 1 minute in seconds


class BufferLogger:
    """
    Tracks EVALSHA operations and logs the dominant project and trace by
    cumulative latency.

    This logger keeps a bounded map (max 1000 entries) of project_and_trace keys
    to their occurrence counts and cumulative latencies. All entries are tracked
    regardless of latency. After processing each batch, if the map exceeds 1000
    entries, it is trimmed to keep only the top 1000 by cumulative latency.
    Every 1 minute (60 seconds), the top 50 entries by cumulative latency are logged at
    INFO level, then the tracked data is cleared.
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

        # Process all entries and accumulate latencies
        for project_and_trace, latency_ms in entries:
            if not self._last_log_time:
                self._last_log_time = time.time()

            if project_and_trace in self._data:
                count, cumulative_latency = self._data[project_and_trace]
                self._data[project_and_trace] = (count + 1, cumulative_latency + latency_ms)
            else:
                self._data[project_and_trace] = (1, latency_ms)

        # Trim to top 1000 entries by cumulative latency if needed
        if len(self._data) > MAX_ENTRIES:
            sorted_items = sorted(self._data.items(), key=lambda x: x[1][1], reverse=True)
            keys_to_remove = [key for key, _ in sorted_items[MAX_ENTRIES:]]
            for key in keys_to_remove:
                del self._data[key]



        if time.time() - (self._last_log_time or 0.0) >= LOGGING_INTERVAL:
            sorted_items = sorted(self._data.items(), key=lambda x: x[1][1], reverse=True)

            if len(sorted_items) > 0:
                entries_str = [
                    f"{key}:{count}:{cumulative_latency}"
                    for key, (count, cumulative_latency) in sorted_items[:50]
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
