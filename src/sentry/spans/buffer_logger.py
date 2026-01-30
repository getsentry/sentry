from __future__ import annotations

import logging
import time

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_ENTRIES = 50
LOGGING_INTERVAL = 60  # 1 minute in seconds


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

        if not self._last_log_time:
            self._last_log_time = time.time()

        for project_and_trace, latency_ms in entries:
            if project_and_trace in self._data:
                count, cumulative_latency = self._data[project_and_trace]
                self._data[project_and_trace] = (count + 1, cumulative_latency + latency_ms)
            else:
                self._data[project_and_trace] = (1, latency_ms)

        if len(self._data) > MAX_ENTRIES:
            sorted_items = sorted(self._data.items(), key=lambda x: x[1][1], reverse=True)
            keys_to_remove = [key for key, _ in sorted_items[MAX_ENTRIES:]]
            for key in keys_to_remove:
                del self._data[key]

        if time.time() - self._last_log_time >= LOGGING_INTERVAL:
            sorted_items = sorted(self._data.items(), key=lambda x: x[1][1], reverse=True)

            if len(sorted_items) > 0:
                entries_str = [
                    f"{key}:{count}:{cumulative_latency}"
                    for key, (count, cumulative_latency) in sorted_items
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
    latency_metrics_dict: dict[str, tuple[float, float, float, float]] = (
        {}
    )  # metric, min, max, sum, count
    gauge_metrics_dict: dict[str, tuple[float, float, float, float]] = (
        {}
    )  # metric, min, max, sum, count

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


ZSET_TO_SET_KEY_MAPPING: dict[str, str] = {
    "zpopcalls": "set_spopcalls",
    "zunionstore_step_latency_ms": "set_sunionstore_step_latency_ms",
    "zpopmin_step_latency_ms": "set_spop_step_latency_ms",
}


def compare_metrics(
    zset_metrics: list[EvalshaData],
    set_metrics: list[EvalshaData],
) -> None:
    """
    Reports the difference (SET - ZSET) between metrics.

    SET metrics are expected to have a "set_" prefix (e.g., "set_redirect_depth").
    Special cases are handled via ZSET_TO_SET_KEY_MAPPING.
    """
    differences: dict[str, tuple[float, float, float, float]] = {}

    for zset_evalsha, set_evalsha in zip(zset_metrics, set_metrics):
        set_dict: dict[str, float] = {
            raw_key.decode("utf-8"): value for raw_key, value in set_evalsha
        }

        for raw_key, zset_value in zset_evalsha:
            zset_key = raw_key.decode("utf-8")
            set_key = ZSET_TO_SET_KEY_MAPPING.get(zset_key, f"set_{zset_key}")

            if set_key not in set_dict:
                continue

            diff = set_dict[set_key] - zset_value

            if zset_key not in differences:
                differences[zset_key] = (diff, diff, diff, 1.0)
            else:
                differences[zset_key] = (
                    min(differences[zset_key][0], diff),
                    max(differences[zset_key][1], diff),
                    differences[zset_key][2] + diff,
                    differences[zset_key][3] + 1.0,
                )

    for key, (min_val, max_val, sum_val, count) in differences.items():
        metrics.gauge(f"spans.buffer.set_vs_zset.min_{key}", min_val)
        metrics.gauge(f"spans.buffer.set_vs_zset.max_{key}", max_val)
        metrics.gauge(f"spans.buffer.set_vs_zset.avg_{key}", sum_val / count)
