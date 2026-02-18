from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any, NamedTuple

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_ENTRIES = 50
LOGGING_INTERVAL = 60  # 1 minute in seconds


class FlusherLogEntry(NamedTuple):
    project_and_trace: str
    span_count: int
    bytes_flushed: int


def _prune_and_maybe_log(
    data: dict[str, tuple[Any, ...]],
    last_log_time: float | None,
    sort_index: int,
    log_message: str,
    entries_key: str,
    format_entry: Callable[[str, tuple[Any, ...]], str],
    extra: dict[str, Any] | None = None,
) -> float | None:
    """
    Pruning and logging logic for loggers.

    Prunes data to MAX_ENTRIES by sort_index, and every LOGGING_INTERVAL
    logs the top entries and clears data.

    Returns the updated last_log_time. Returns None when data was logged.
    """
    if not last_log_time:
        last_log_time = time.time()

    if len(data) > MAX_ENTRIES:
        sorted_items = sorted(data.items(), key=lambda x: x[1][sort_index], reverse=True)
        keys_to_remove = [key for key, _ in sorted_items[MAX_ENTRIES:]]
        for key in keys_to_remove:
            del data[key]

    if time.time() - last_log_time >= LOGGING_INTERVAL:
        sorted_items = sorted(data.items(), key=lambda x: x[1][sort_index], reverse=True)

        if len(sorted_items) > 0:
            entries_str = [format_entry(key, value) for key, value in sorted_items]

            log_extra: dict[str, Any] = {
                entries_key: entries_str,
                "num_tracked_keys": len(data),
                "pruned_list": len(data) == MAX_ENTRIES,
            }
            if extra:
                log_extra.update(extra)

            logger.info(log_message, extra=log_extra)

        data.clear()
        return None

    return last_log_time


class BufferLogger:
    """
    Tracks EVALSHA operations and logs the dominant project and trace by
    cumulative latency.

    This logger keeps a bounded map (max 50 entries) of project_and_trace keys
    to their occurrence counts and cumulative latencies.
    Every minute the top 50 traces by cumulative latency are logged at INFO level.
    """

    def __init__(self) -> None:
        self._data: dict[str, tuple[int, int]] = {}
        self._last_log_time: float | None = None

    def log(self, entries: list[tuple[str, int]]) -> None:
        """
        Record a batch of EVALSHA operations and periodically log the top offenders.

        :param entries: List of tuples containing (project_and_trace, latency_ms) pairs.
        """

        if not options.get("spans.buffer.evalsha-cumulative-logger-enabled"):
            return

        for project_and_trace, latency_ms in entries:
            if project_and_trace in self._data:
                count, cumulative_latency = self._data[project_and_trace]
                self._data[project_and_trace] = (count + 1, cumulative_latency + latency_ms)
            else:
                self._data[project_and_trace] = (1, latency_ms)

        self._last_log_time = _prune_and_maybe_log(
            self._data,
            self._last_log_time,
            sort_index=1,
            log_message="spans.buffer.slow_evalsha_operations",
            entries_key="top_slow_operations",
            format_entry=lambda key, val: f"{key}:{val[0]}:{val[1]}",
        )


class FlusherLogger:
    """
    Tracks per-trace flush operations and logs the dominant traces by
    cumulative bytes flushed.

    This logger keeps a bounded map (max 50 entries) of project_and_trace keys
    to their segment counts, span counts, and cumulative bytes.
    Every minute the top 50 traces by cumulative bytes are logged at INFO level,
    along with the cumulative per-phase latencies over the logging interval.
    """

    def __init__(self) -> None:
        self._data: dict[str, tuple[int, int, int]] = {}
        self._cumulative_load_ids_latency_ms: int = 0
        self._cumulative_load_data_latency_ms: int = 0
        self._cumulative_decompress_latency_ms: int = 0
        self._last_log_time: float | None = None

    def log(
        self,
        entries: list[FlusherLogEntry],
        load_ids_latency_ms: int,
        load_data_latency_ms: int,
        decompress_latency_ms: int,
    ) -> None:
        """
        Record a batch of flush operations and periodically log the top traces sorted by
        cumulative bytes flushed.
        """

        if not options.get("spans.buffer.flusher-cumulative-logger-enabled"):
            return

        self._cumulative_load_ids_latency_ms += load_ids_latency_ms
        self._cumulative_load_data_latency_ms += load_data_latency_ms
        self._cumulative_decompress_latency_ms += decompress_latency_ms

        for entry in entries:
            if entry.project_and_trace in self._data:
                prev_segments, prev_spans, prev_bytes = self._data[entry.project_and_trace]
                self._data[entry.project_and_trace] = (
                    prev_segments + 1,
                    prev_spans + entry.span_count,
                    prev_bytes + entry.bytes_flushed,
                )
            else:
                self._data[entry.project_and_trace] = (
                    1,
                    entry.span_count,
                    entry.bytes_flushed,
                )

        self._last_log_time = _prune_and_maybe_log(
            self._data,
            self._last_log_time,
            sort_index=2,
            log_message="spans.buffer.top_flush_operations_by_bytes",
            entries_key="top_flush_operations",
            format_entry=lambda key, val: f"{key}:{val[0]}:{val[1]}:{val[2]}",
            extra={
                "cumulative_load_ids_latency_ms": self._cumulative_load_ids_latency_ms,
                "cumulative_load_data_latency_ms": self._cumulative_load_data_latency_ms,
                "cumulative_decompress_latency_ms": self._cumulative_decompress_latency_ms,
            },
        )
        if self._last_log_time is None:
            self._cumulative_load_ids_latency_ms = 0
            self._cumulative_load_data_latency_ms = 0
            self._cumulative_decompress_latency_ms = 0


type DataPoint = tuple[bytes, float]
type EvalshaData = list[DataPoint]


def emit_observability_metrics(
    latency_metrics: list[EvalshaData],
    gauge_metrics: list[EvalshaData],
    longest_evalsha_data: tuple[float, EvalshaData, EvalshaData],
) -> None:
    """
    This function takes all the observability metrics returned for a batch of EVALSHA operations on the
    add-buffer.lua script, aggregates them, and emits them as metrics.

    The input is two lists:
    - latency_metrics: Each element is a list of tuples, where each tuple represents the duration of a single step of the EVALSHA operation.
    - gauge_metrics: Each element is a list of tuples, where each tuple represents a single value returned by the EVALSHA operation.

    For each metric that can be emitted, calculate the min, max and avg across the batch.
    For the longest evalsha, emit a special metric for that evalsha that is just the values
    without aggregation.
    """
    latency_metrics_dict: dict[
        str, tuple[float, float, float, float]
    ] = {}  # metric, min, max, sum, count
    gauge_metrics_dict: dict[
        str, tuple[float, float, float, float]
    ] = {}  # metric, min, max, sum, count

    for evalsha_latency_metrics, evalsha_gauge_metrics in zip(latency_metrics, gauge_metrics):
        for raw_key, value in evalsha_latency_metrics:
            key = raw_key.decode("utf-8")
            if key not in latency_metrics_dict:
                latency_metrics_dict[key] = (value, value, value, 1.0)
            else:
                latency_metrics_dict[key] = (
                    min(latency_metrics_dict[key][0], value),
                    max(latency_metrics_dict[key][1], value),
                    latency_metrics_dict[key][2] + value,
                    latency_metrics_dict[key][3] + 1.0,
                )
        for raw_key, value in evalsha_gauge_metrics:
            key = raw_key.decode("utf-8")
            if key not in gauge_metrics_dict:
                gauge_metrics_dict[key] = (value, value, value, 1.0)
            else:
                gauge_metrics_dict[key] = (
                    min(gauge_metrics_dict[key][0], value),
                    max(gauge_metrics_dict[key][1], value),
                    gauge_metrics_dict[key][2] + value,
                    gauge_metrics_dict[key][3] + 1.0,
                )

    for metric, (min_value, max_value, sum_value, count) in latency_metrics_dict.items():
        metrics.timing(f"spans.buffer.process_spans.avg_{metric}", sum_value / count)
        metrics.timing(f"spans.buffer.process_spans.min_{metric}", min_value)
        metrics.timing(f"spans.buffer.process_spans.max_{metric}", max_value)
    for metric, (min_value, max_value, sum_value, count) in gauge_metrics_dict.items():
        metrics.gauge(f"spans.buffer.avg_{metric}", sum_value / count)
        metrics.gauge(f"spans.buffer.min_{metric}", min_value)
        metrics.gauge(f"spans.buffer.max_{metric}", max_value)

    for data_point in longest_evalsha_data[1]:  # latency_metrics
        key = data_point[0].decode("utf-8")
        metrics.timing(f"spans.buffer.process_spans.longest_evalsha.latency.{key}", data_point[1])
    for data_point in longest_evalsha_data[2]:  # gauge_metrics
        key = data_point[0].decode("utf-8")
        metrics.gauge(f"spans.buffer.process_spans.longest_evalsha.{key}", data_point[1])
