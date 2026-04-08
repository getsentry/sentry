"""Tests for log analyzer module."""

from __future__ import annotations

from datetime import datetime, timezone

from sentry.spans.log_analyzer import (
    FlusherLogAnalyzer,
    FlusherLogEntry,
    FlusherTraceData,
    LogAnalyzer,
    LogEntry,
    TraceSpans,
    parse_top_flush_operations,
    parse_top_traces,
)


def _make_buffer_log_entry(
    timestamp: datetime,
    operations: list[str],
    consumer: str = "process-spans-6",
) -> LogEntry:
    return LogEntry(
        timestamp=timestamp,
        consumer=consumer,
        traces=parse_top_traces(operations),
    )


def _make_flusher_log_entry(
    timestamp: datetime,
    operations: list[str],
    consumer: str = "flusher-0",
    load_ids_ms: int = 0,
    load_data_ms: int = 0,
    decompress_ms: int = 0,
) -> FlusherLogEntry:
    return FlusherLogEntry(
        timestamp=timestamp,
        consumer=consumer,
        traces=parse_top_flush_operations(operations),
        cumulative_load_ids_latency_ms=load_ids_ms,
        cumulative_load_data_latency_ms=load_data_ms,
        cumulative_decompress_latency_ms=decompress_ms,
    )


class TestParseTopTraces:
    def test_parses_valid_entries(self) -> None:
        results = parse_top_traces(["123:aabb0011:100:5000", "456:ccdd0022:50:2000"])

        assert len(results) == 2
        assert results[0] == TraceSpans(
            project_id="123", trace_id="aabb0011", count=100, cumulative_latency_ms=5000
        )

    def test_skips_malformed_entries(self) -> None:
        results = parse_top_traces(["bad_entry", "too:few", "123:aabb0011:100:5000"])

        assert len(results) == 1


class TestParseTopFlushOperations:
    def test_parses_valid_entries(self) -> None:
        results = parse_top_flush_operations(
            ["123:aabb0011:5:200:50000", "456:ccdd0022:2:100:20000"]
        )

        assert len(results) == 2
        assert results[0] == FlusherTraceData(
            project_id="123",
            trace_id="aabb0011",
            segment_count=5,
            span_count=200,
            bytes_flushed=50000,
        )

    def test_skips_malformed_entries(self) -> None:
        results = parse_top_flush_operations(
            ["bad_entry", "too:few:parts", "123:aabb0011:5:200:50000"]
        )

        assert len(results) == 1


class TestLogAnalyzer:
    def test_aggregates_across_entries(self) -> None:
        entries = [
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:100:5000"],
            ),
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc),
                ["123:aabb0011:200:3000"],
            ),
        ]
        analyzer = LogAnalyzer(entries)
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].total_latency_ms == 8000
        assert traces[0].total_count == 300
        assert traces[0].log_entries == 2
        assert traces[0].duration == "0:01:00"

    def test_filter_by_project(self) -> None:
        entries = [
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:100:5000", "456:ccdd0022:50:2000"],
            ),
        ]
        analyzer = LogAnalyzer(entries).filter_by_project("123")
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].project_id == "123"

    def test_filter_by_trace(self) -> None:
        entries = [
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:100:5000", "456:ccdd0022:50:2000"],
            ),
        ]
        analyzer = LogAnalyzer(entries).filter_by_trace("ccdd0022")
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].trace_id == "ccdd0022"

    def test_summary_stats(self) -> None:
        entries = [
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:100:5000"],
                consumer="process-spans-6",
            ),
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc),
                ["456:ccdd0022:50:2000"],
                consumer="process-spans-7",
            ),
        ]
        analyzer = LogAnalyzer(entries)
        stats = analyzer.get_summary_stats()

        assert stats["total_traces"] == 2
        assert stats["total_operations"] == 150
        assert stats["total_log_entries"] == 2
        assert stats["time_range_start"] == datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc)
        assert stats["time_range_end"] == datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc)
        assert stats["consumer_counts"] == {"process-spans-6": 1, "process-spans-7": 1}

    def test_respects_limit(self) -> None:
        entries = [
            _make_buffer_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                [f"{i}:trace{i}:1:100" for i in range(10)],
            ),
        ]
        analyzer = LogAnalyzer(entries)
        traces = analyzer.get_top_traces(limit=3)

        assert len(traces) == 3


class TestFlusherLogAnalyzer:
    def test_aggregates_across_entries(self) -> None:
        entries = [
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:5:200:50000"],
            ),
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc),
                ["123:aabb0011:3:150:30000"],
            ),
        ]
        analyzer = FlusherLogAnalyzer(entries)
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].total_bytes_flushed == 80000
        assert traces[0].total_span_count == 350
        assert traces[0].total_segment_count == 8

    def test_sorts_by_bytes_flushed(self) -> None:
        entries = [
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:5:200:50000", "456:ccdd0022:2:100:20000"],
            ),
        ]
        analyzer = FlusherLogAnalyzer(entries)
        traces = analyzer.get_top_traces()

        assert len(traces) == 2
        assert traces[0].total_bytes_flushed == 50000
        assert traces[1].total_bytes_flushed == 20000

    def test_filter_by_project(self) -> None:
        entries = [
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:5:200:50000", "456:ccdd0022:2:100:20000"],
            ),
        ]
        analyzer = FlusherLogAnalyzer(entries).filter_by_project("456")
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].project_id == "456"

    def test_filter_by_trace(self) -> None:
        entries = [
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:5:200:50000", "456:ccdd0022:2:100:20000"],
            ),
        ]
        analyzer = FlusherLogAnalyzer(entries).filter_by_trace("aabb0011")
        traces = analyzer.get_top_traces()

        assert len(traces) == 1
        assert traces[0].trace_id == "aabb0011"

    def test_summary_stats_with_latencies(self) -> None:
        entries = [
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                ["123:aabb0011:5:200:50000"],
                consumer="flusher-0",
                load_ids_ms=100,
                load_data_ms=500,
                decompress_ms=30,
            ),
            _make_flusher_log_entry(
                datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc),
                ["456:ccdd0022:2:100:20000"],
                consumer="flusher-1",
                load_ids_ms=80,
                load_data_ms=400,
                decompress_ms=20,
            ),
        ]
        analyzer = FlusherLogAnalyzer(entries)
        stats = analyzer.get_summary_stats()

        assert stats["total_traces"] == 2
        assert stats["total_bytes_flushed"] == 70000
        assert stats["total_spans"] == 300
        assert stats["total_segments"] == 7
        assert stats["total_log_entries"] == 2
        assert stats["total_load_ids_latency_ms"] == 180
        assert stats["total_load_data_latency_ms"] == 900
        assert stats["total_decompress_latency_ms"] == 50
        assert stats["consumer_counts"] == {"flusher-0": 1, "flusher-1": 1}
