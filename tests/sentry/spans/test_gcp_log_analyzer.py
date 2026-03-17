"""Tests for GCP Log Analyzer CLI and formatting."""

from __future__ import annotations

from datetime import datetime, timezone

from sentry.spans.gcp_log_analyzer import (
    format_flusher_summary,
    format_flusher_trace_table,
    format_summary,
    format_trace_table,
)
from sentry.spans.log_analyzer import (
    FlusherSummaryStats,
    FlusherTraceStats,
    SummaryStats,
    TraceStats,
)


def test_format_trace_table():
    """Test formatting trace table."""
    traces = [
        TraceStats(
            project_id="123123123",
            trace_id="6a499a5de1f6e3b412adb0ef12345678",
            total_latency_ms=26557,
            total_count=2303,
            log_entries=1,
            first_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            last_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
        ),
        TraceStats(
            project_id="5471332",
            trace_id="fc8dc7a8bee64349960bbc9412345678",
            total_latency_ms=6,
            total_count=6,
            log_entries=1,
            first_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            last_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
        ),
    ]

    result = format_trace_table(traces)

    assert "Top Traces by Cumulative Latency" in result
    assert "123123123" in result
    assert "26,557 ms" in result
    assert "2,303" in result


def test_format_empty_traces():
    """Test formatting empty trace list."""
    result = format_trace_table([])

    assert "No traces found" in result


def test_format_summary():
    """Test formatting summary statistics."""
    stats: SummaryStats = {
        "total_traces": 2,
        "total_operations": 2309,
        "total_log_entries": 20,
        "time_range_start": datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
        "time_range_end": datetime(2026, 2, 3, 18, 54, 37, tzinfo=timezone.utc),
        "consumer_counts": {"process-spans-6": 20},
    }

    result = format_summary(stats)

    assert "Total traces: 2" in result
    assert "Total operations: 2,309" in result
    assert "process-spans-6 (20)" in result


def test_format_flusher_trace_table():
    """Test formatting flusher trace table."""
    traces = [
        FlusherTraceStats(
            project_id="123123123",
            trace_id="6a499a5de1f6e3b412adb0ef12345678",
            total_bytes_flushed=1048576,
            total_span_count=500,
            total_segment_count=10,
        ),
        FlusherTraceStats(
            project_id="5471332",
            trace_id="fc8dc7a8bee64349960bbc9412345678",
            total_bytes_flushed=2048,
            total_span_count=20,
            total_segment_count=2,
        ),
    ]

    result = format_flusher_trace_table(traces)

    assert "Top Traces by Bytes Flushed" in result
    assert "123123123" in result
    assert "1,048,576" in result
    assert "500" in result
    assert "Log Entries" not in result


def test_format_flusher_empty_traces():
    """Test formatting empty flusher trace list."""
    result = format_flusher_trace_table([])

    assert "No traces found" in result


def test_format_flusher_summary():
    """Test formatting flusher summary statistics."""
    stats: FlusherSummaryStats = {
        "total_traces": 2,
        "total_bytes_flushed": 1050624,
        "total_spans": 520,
        "total_segments": 12,
        "total_log_entries": 4,
        "total_load_ids_latency_ms": 400,
        "total_load_data_latency_ms": 2000,
        "total_decompress_latency_ms": 120,
        "time_range_start": datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
        "time_range_end": datetime(2026, 2, 3, 18, 55, 36, tzinfo=timezone.utc),
        "consumer_counts": {"flusher-0": 4},
    }

    result = format_flusher_summary(stats)

    assert "Total traces: 2" in result
    assert "Total bytes flushed: 1,050,624" in result
    assert "Total spans: 520" in result
    assert "Total segments: 12" in result
    assert "Phase Latencies" in result
    assert "load_ids:" in result
    assert "400 ms" in result
    assert "avg 100 ms/entry" in result
    assert "load_data:" in result
    assert "2,000 ms" in result
    assert "decompress:" in result
    assert "flusher-0 (4)" in result
