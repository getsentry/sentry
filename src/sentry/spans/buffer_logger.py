from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any, NamedTuple, TypeVar

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_ENTRIES = 50
LOGGING_INTERVAL = 60  # 1 minute in seconds


class FlusherLogEntry(NamedTuple):
    """
    Represents a single flush operation for a given project and trace.
    """

    project_and_trace: str
    span_count: int
    bytes_flushed: int


class BufferAggregate(NamedTuple):
    """
    Tracks the number of operations and cumulative latency for a given project and trace.
    """

    operation_count: int
    cumulative_latency_ms: int


class FlusherAggregate(NamedTuple):
    """
    Tracks the number of segments, spans, and bytes flushed for a given project and trace.
    """

    segment_count: int
    span_count: int
    bytes_flushed: int


TAggregate = TypeVar("TAggregate", bound=tuple[Any, ...])


def _prune_and_maybe_log(
    metrics_per_trace: dict[str, TAggregate],
    last_log_time: float | None,
    sort_index: int,
    log_message: str,
    entries_key: str,
    format_entry: Callable[[str, TAggregate], str],
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

    if len(metrics_per_trace) > MAX_ENTRIES:
        sorted_items = sorted(
            metrics_per_trace.items(), key=lambda x: x[1][sort_index], reverse=True
        )
        keys_to_remove = [key for key, _ in sorted_items[MAX_ENTRIES:]]
        for key in keys_to_remove:
            del metrics_per_trace[key]

    if time.time() - last_log_time >= LOGGING_INTERVAL:
        sorted_items = sorted(
            metrics_per_trace.items(), key=lambda x: x[1][sort_index], reverse=True
        )

        if len(sorted_items) > 0:
            entries_str = [format_entry(key, value) for key, value in sorted_items]

            log_extra: dict[str, Any] = {
                entries_key: entries_str,
                "num_tracked_keys": len(metrics_per_trace),
                "pruned_list": len(metrics_per_trace) == MAX_ENTRIES,
            }
            if extra:
                log_extra.update(extra)

            logger.info(log_message, extra=log_extra)

        metrics_per_trace.clear()
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
        self._metrics_per_trace: dict[str, BufferAggregate] = {}
        self._last_log_time: float | None = None

    def log(self, entries: list[tuple[str, int]]) -> None:
        """
        Record a batch of EVALSHA operations and periodically log the top offenders.

        :param entries: List of tuples containing (project_and_trace, latency_ms) pairs.
        """

        if not options.get("spans.buffer.evalsha-cumulative-logger-enabled"):
            return

        for project_and_trace, latency_ms in entries:
            if project_and_trace in self._metrics_per_trace:
                aggregate = self._metrics_per_trace[project_and_trace]
                self._metrics_per_trace[project_and_trace] = BufferAggregate(
                    aggregate.operation_count + 1,
                    aggregate.cumulative_latency_ms + latency_ms,
                )
            else:
                self._metrics_per_trace[project_and_trace] = BufferAggregate(1, latency_ms)

        self._last_log_time = _prune_and_maybe_log(
            self._metrics_per_trace,
            self._last_log_time,
            sort_index=1,
            log_message="spans.buffer.slow_evalsha_operations",
            entries_key="top_slow_operations",
            format_entry=lambda key,
            val: f"{key}:{val.operation_count}:{val.cumulative_latency_ms}",
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
        self._metrics_per_trace: dict[str, FlusherAggregate] = {}
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
            if entry.project_and_trace in self._metrics_per_trace:
                aggregate = self._metrics_per_trace[entry.project_and_trace]
                self._metrics_per_trace[entry.project_and_trace] = FlusherAggregate(
                    aggregate.segment_count + 1,
                    aggregate.span_count + entry.span_count,
                    aggregate.bytes_flushed + entry.bytes_flushed,
                )
            else:
                self._metrics_per_trace[entry.project_and_trace] = FlusherAggregate(
                    1,
                    entry.span_count,
                    entry.bytes_flushed,
                )

        self._last_log_time = _prune_and_maybe_log(
            self._metrics_per_trace,
            self._last_log_time,
            sort_index=2,
            log_message="spans.buffer.top_flush_operations_by_bytes",
            entries_key="top_flush_operations",
            format_entry=lambda key, val: (
                f"{key}:{val.segment_count}:{val.span_count}:{val.bytes_flushed}"
            ),
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
    oversized_count = 0

    size_buckets = {
        "<1000": 0,
        "1000-2000": 0,
        "2000-5000": 0,
        "5000-10000": 0,
        "10000-20000": 0,
        ">20000": 0,
    }
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
            # Temporary metrics for potential limits being added
            if key == "parent_span_set_after_size":
                if value > 20000:
                    size_buckets[">20000"] += 1
                elif value > 10000:
                    size_buckets["10000-20000"] += 1
                elif value > 5000:
                    size_buckets["5000-10000"] += 1
                elif value > 2000:
                    size_buckets["2000-5000"] += 1
                elif value > 1000:
                    size_buckets["1000-2000"] += 1
                else:
                    size_buckets["<1000"] += 1

            if key not in gauge_metrics_dict:
                gauge_metrics_dict[key] = (value, value, value, 1.0)
            else:
                gauge_metrics_dict[key] = (
                    min(gauge_metrics_dict[key][0], value),
                    max(gauge_metrics_dict[key][1], value),
                    gauge_metrics_dict[key][2] + value,
                    gauge_metrics_dict[key][3] + 1.0,
                )
            if raw_key == b"parent_span_set_already_oversized":
                oversized_count += int(value)

    # Temporary metrics for potential limits being added
    for size, scount in size_buckets.items():
        if scount > 0:
            metrics.incr(
                "spans.buffer.parent_span_set_after_size_bucket", scount, tags={"size": size}
            )

    for metric, (min_value, max_value, sum_value, count) in latency_metrics_dict.items():
        tags = {"stage": metric}
        metrics.timing(
            "spans.buffer.process_spans.avg_step_latency_ms", sum_value / count, tags=tags
        )
        metrics.timing("spans.buffer.process_spans.min_step_latency_ms", min_value, tags=tags)
        metrics.timing("spans.buffer.process_spans.max_step_latency_ms", max_value, tags=tags)
    for metric, (min_value, max_value, sum_value, count) in gauge_metrics_dict.items():
        tags = {"stage": metric}
        metrics.gauge("spans.buffer.avg_gauge_metric", sum_value / count, tags=tags)
        metrics.gauge("spans.buffer.min_gauge_metric", min_value, tags=tags)
        metrics.gauge("spans.buffer.max_gauge_metric", max_value, tags=tags)

    for raw_key, value in longest_evalsha_data[1]:  # latency_metrics
        key = raw_key.decode("utf-8")
        metrics.timing(
            "spans.buffer.process_spans.longest_evalsha.step_latency_ms",
            value,
            tags={"stage": key},
        )
    for raw_key, value in longest_evalsha_data[2]:  # gauge_metrics
        key = raw_key.decode("utf-8")
        metrics.gauge(
            "spans.buffer.process_spans.longest_evalsha.gauge_metric",
            value,
            tags={"stage": key},
        )

    if oversized_count > 0:
        metrics.incr(
            "spans.buffer.process_spans.parent_span_set_already_oversized.count",
            amount=oversized_count,
        )
