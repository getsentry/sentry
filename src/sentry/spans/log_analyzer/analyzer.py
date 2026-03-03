from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from sentry.spans.log_analyzer.fetchers import FlusherLogEntry, LogEntry


@dataclass
class TraceStats:
    """
    Tracks the cumulative impact on CPU usage of a trace over a period of time.
    """

    project_id: str
    trace_id: str
    total_latency_ms: int
    total_count: int  # Number of EVALSHA operations executed for this trace.
    # in the time range
    log_entries: int
    first_seen: datetime  # First time we saw this trace in the log in the time reange.
    last_seen: datetime  # Last time we saw this trace in the log in the time reange.

    @property
    def duration(self) -> str:
        """
        Period of time between we saw this trace in the log time range.
        """
        delta = self.last_seen - self.first_seen
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours}:{minutes:02d}:{seconds:02d}"


class SummaryStats(TypedDict):
    total_traces: int
    total_operations: int
    total_log_entries: int
    time_range_start: datetime | None
    time_range_end: datetime | None
    consumer_counts: dict[str, int]


TraceKey = tuple[str, str]  # (project_id, trace_id)


class LogAnalyzer:
    """
    Aggregates and analyzes the trace cumulative logs from GCP over a period of time.

    This class is provided with a list of LogEntry instances, each of which corresponds
    to a log entry produced by the spans buffer. Each of the log entries contains the
    top X traces by cumulative time spent in the buffer.

    This class:
    - filters the log entries by project or trace id.
    - aggregates all the traces in the log entries by trace id generating a
      comprehensive summary of the most impactful traces on the buffer resources.
    """

    def __init__(self, log_entries: list[LogEntry]):
        self.log_entries = log_entries
        self._trace_stats: dict[TraceKey, TraceStats] | None = None

    def filter_by_project(self, project_id: str) -> LogAnalyzer:
        """
        Filter traces by project ID (client-side filtering).
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.traces if op.project_id == project_id]
            if filtered_ops:
                filtered_entries.append(
                    LogEntry(
                        timestamp=entry.timestamp, consumer=entry.consumer, traces=filtered_ops
                    )
                )
        return LogAnalyzer(filtered_entries)

    def filter_by_trace(self, trace_id: str) -> LogAnalyzer:
        """
        Filter traces by trace ID (client-side filtering).
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.traces if op.trace_id == trace_id]
            if filtered_ops:
                filtered_entries.append(
                    LogEntry(
                        timestamp=entry.timestamp, consumer=entry.consumer, traces=filtered_ops
                    )
                )
        return LogAnalyzer(filtered_entries)

    def aggregate_traces(self) -> dict[TraceKey, TraceStats]:
        """Aggregate traces across log entries.

        Groups by (project_id, trace_id) and sums latency/count.

        Returns:
            Dictionary mapping (project_id, trace_id) to TraceStats
        """
        if self._trace_stats is not None:
            return self._trace_stats

        trace_data: dict[TraceKey, dict[str, Any]] = defaultdict(
            lambda: {
                "total_latency_ms": 0,
                "total_count": 0,
                "log_entries": 0,
                "first_seen": None,
                "last_seen": None,
            }
        )

        for entry in self.log_entries:
            for op in entry.traces:
                key = (op.project_id, op.trace_id)
                stats = trace_data[key]

                stats["total_latency_ms"] += op.cumulative_latency_ms
                stats["total_count"] += op.count
                stats["log_entries"] += 1

                if stats["first_seen"] is None or entry.timestamp < stats["first_seen"]:
                    stats["first_seen"] = entry.timestamp
                if stats["last_seen"] is None or entry.timestamp > stats["last_seen"]:
                    stats["last_seen"] = entry.timestamp

        self._trace_stats = {}
        for (project_id, trace_id), data in trace_data.items():
            self._trace_stats[(project_id, trace_id)] = TraceStats(
                project_id=project_id,
                trace_id=trace_id,
                total_latency_ms=data["total_latency_ms"],
                total_count=data["total_count"],
                log_entries=data["log_entries"],
                first_seen=data["first_seen"],
                last_seen=data["last_seen"],
            )

        return self._trace_stats

    def get_top_traces(self, limit: int = 10) -> list[TraceStats]:
        """
        Get top N traces by total latency.
        """
        traces = list(self.aggregate_traces().values())
        traces.sort(key=lambda t: t.total_latency_ms, reverse=True)
        return traces[:limit]

    def get_summary_stats(self) -> SummaryStats:
        """
        Get summary statistics across all log entries.
        """
        traces = self.aggregate_traces()

        total_traces = len(traces)
        total_operations = sum(t.total_count for t in traces.values())
        total_log_entries = len(self.log_entries)

        if self.log_entries:
            timestamps = [e.timestamp for e in self.log_entries]
            time_range_start = min(timestamps)
            time_range_end = max(timestamps)
        else:
            time_range_start = None
            time_range_end = None

        consumer_counts: dict[str, int] = defaultdict(int)
        for entry in self.log_entries:
            consumer_counts[entry.consumer_name] += 1

        return {
            "total_traces": total_traces,
            "total_operations": total_operations,
            "total_log_entries": total_log_entries,
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "consumer_counts": dict(consumer_counts),
        }


@dataclass
class FlusherTraceStats:
    """
    Tracks the cumulative bytes flushed for a trace over a period of time.
    """

    project_id: str
    trace_id: str
    total_bytes_flushed: int
    total_span_count: int
    total_segment_count: int


class FlusherSummaryStats(TypedDict):
    total_traces: int
    total_bytes_flushed: int
    total_spans: int
    total_segments: int
    total_log_entries: int
    total_load_ids_latency_ms: int
    total_load_data_latency_ms: int
    total_decompress_latency_ms: int
    time_range_start: datetime | None
    time_range_end: datetime | None
    consumer_counts: dict[str, int]


class FlusherLogAnalyzer:
    """
    Aggregates and analyzes the flusher logs from GCP over a period of time.

    This class is provided with a list of FlusherLogEntry instances, each of which
    corresponds to a log entry produced by the span flusher. Each of the log entries
    contains the top X traces by cumulative bytes flushed.

    This class:
    - filters the log entries by project or trace id.
    - aggregates all the traces in the log entries by trace id generating a
      comprehensive summary of the most impactful traces by bytes flushed.
    """

    def __init__(self, log_entries: list[FlusherLogEntry]):
        self.log_entries = log_entries
        self._trace_stats: dict[TraceKey, FlusherTraceStats] | None = None

    def filter_by_project(self, project_id: str) -> FlusherLogAnalyzer:
        """
        Filter traces by project ID (client-side filtering).
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.traces if op.project_id == project_id]
            if filtered_ops:
                filtered_entries.append(
                    FlusherLogEntry(
                        timestamp=entry.timestamp,
                        consumer=entry.consumer,
                        traces=filtered_ops,
                        cumulative_load_ids_latency_ms=entry.cumulative_load_ids_latency_ms,
                        cumulative_load_data_latency_ms=entry.cumulative_load_data_latency_ms,
                        cumulative_decompress_latency_ms=entry.cumulative_decompress_latency_ms,
                    )
                )
        return FlusherLogAnalyzer(filtered_entries)

    def filter_by_trace(self, trace_id: str) -> FlusherLogAnalyzer:
        """
        Filter traces by trace ID (client-side filtering).
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.traces if op.trace_id == trace_id]
            if filtered_ops:
                filtered_entries.append(
                    FlusherLogEntry(
                        timestamp=entry.timestamp,
                        consumer=entry.consumer,
                        traces=filtered_ops,
                        cumulative_load_ids_latency_ms=entry.cumulative_load_ids_latency_ms,
                        cumulative_load_data_latency_ms=entry.cumulative_load_data_latency_ms,
                        cumulative_decompress_latency_ms=entry.cumulative_decompress_latency_ms,
                    )
                )
        return FlusherLogAnalyzer(filtered_entries)

    def aggregate_traces(self) -> dict[TraceKey, FlusherTraceStats]:
        """Aggregate traces across log entries.

        Groups by (project_id, trace_id) and sums bytes/spans/segments.

        Returns:
            Dictionary mapping (project_id, trace_id) to FlusherTraceStats
        """
        if self._trace_stats is not None:
            return self._trace_stats

        trace_data: dict[TraceKey, dict[str, Any]] = defaultdict(
            lambda: {
                "total_bytes_flushed": 0,
                "total_span_count": 0,
                "total_segment_count": 0,
            }
        )

        for entry in self.log_entries:
            for op in entry.traces:
                key = (op.project_id, op.trace_id)
                stats = trace_data[key]

                stats["total_bytes_flushed"] += op.bytes_flushed
                stats["total_span_count"] += op.span_count
                stats["total_segment_count"] += op.segment_count

        self._trace_stats = {}
        for (project_id, trace_id), data in trace_data.items():
            self._trace_stats[(project_id, trace_id)] = FlusherTraceStats(
                project_id=project_id,
                trace_id=trace_id,
                total_bytes_flushed=data["total_bytes_flushed"],
                total_span_count=data["total_span_count"],
                total_segment_count=data["total_segment_count"],
            )

        return self._trace_stats

    def get_top_traces(self, limit: int = 10) -> list[FlusherTraceStats]:
        """
        Get top N traces by total bytes flushed.
        """
        traces = list(self.aggregate_traces().values())
        traces.sort(key=lambda t: t.total_bytes_flushed, reverse=True)
        return traces[:limit]

    def get_summary_stats(self) -> FlusherSummaryStats:
        """
        Get summary statistics across all log entries.
        """
        traces = self.aggregate_traces()

        total_traces = len(traces)
        total_bytes = sum(t.total_bytes_flushed for t in traces.values())
        total_spans = sum(t.total_span_count for t in traces.values())
        total_segments = sum(t.total_segment_count for t in traces.values())
        total_log_entries = len(self.log_entries)

        total_load_ids = sum(e.cumulative_load_ids_latency_ms for e in self.log_entries)
        total_load_data = sum(e.cumulative_load_data_latency_ms for e in self.log_entries)
        total_decompress = sum(e.cumulative_decompress_latency_ms for e in self.log_entries)

        if self.log_entries:
            timestamps = [e.timestamp for e in self.log_entries]
            time_range_start = min(timestamps)
            time_range_end = max(timestamps)
        else:
            time_range_start = None
            time_range_end = None

        consumer_counts: dict[str, int] = defaultdict(int)
        for entry in self.log_entries:
            consumer_counts[entry.consumer_name] += 1

        return {
            "total_traces": total_traces,
            "total_bytes_flushed": total_bytes,
            "total_spans": total_spans,
            "total_segments": total_segments,
            "total_log_entries": total_log_entries,
            "total_load_ids_latency_ms": total_load_ids,
            "total_load_data_latency_ms": total_load_data,
            "total_decompress_latency_ms": total_decompress,
            "time_range_start": time_range_start,
            "time_range_end": time_range_end,
            "consumer_counts": dict(consumer_counts),
        }
