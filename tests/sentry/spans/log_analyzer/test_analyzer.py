from __future__ import annotations

from datetime import datetime, timezone

import pytest

from sentry.spans.log_analyzer.analyzer import LogAnalyzer, TraceStats
from sentry.spans.log_analyzer.fetchers import LogEntry, TraceSpans


@pytest.fixture
def sample_log_entries():
    """Create sample log entries for testing."""
    return [
        LogEntry(
            timestamp=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            consumer="process-spans-6",
            traces=[
                TraceSpans("4505130643619840", "trace-a", 4, 600),
                TraceSpans("6743973", "trace-b", 5, 500),
            ],
        ),
        LogEntry(
            timestamp=datetime(2026, 2, 3, 18, 54, 37, tzinfo=timezone.utc),
            consumer="process-spans-6",
            traces=[
                TraceSpans("4505130643619840", "trace-a", 2, 400),
                TraceSpans("9999999", "trace-c", 3, 300),
            ],
        ),
    ]


def test_aggregate_traces(sample_log_entries):
    """Test aggregating traces across log entries."""
    analyzer = LogAnalyzer(sample_log_entries)
    traces = analyzer.aggregate_traces()

    assert len(traces) == 3

    key = ("4505130643619840", "trace-a")
    assert key in traces
    trace_a = traces[key]
    assert trace_a.total_latency_ms == 1000
    assert trace_a.total_count == 6
    assert trace_a.log_entries == 2


def test_filter_by_project(sample_log_entries):
    """Test filtering by project ID."""
    analyzer = LogAnalyzer(sample_log_entries)
    filtered = analyzer.filter_by_project("4505130643619840")

    assert len(filtered.log_entries) == 2
    assert all(
        op.project_id == "4505130643619840" for entry in filtered.log_entries for op in entry.traces
    )


def test_filter_by_trace(sample_log_entries):
    """Test filtering by trace ID."""
    analyzer = LogAnalyzer(sample_log_entries)
    filtered = analyzer.filter_by_trace("trace-a")

    assert len(filtered.log_entries) == 2
    assert all(op.trace_id == "trace-a" for entry in filtered.log_entries for op in entry.traces)


def test_get_top_traces(sample_log_entries):
    """Test getting top traces by latency."""
    analyzer = LogAnalyzer(sample_log_entries)
    top_traces = analyzer.get_top_traces(limit=2)

    assert len(top_traces) == 2
    assert top_traces[0].total_latency_ms >= top_traces[1].total_latency_ms
    assert top_traces[0].total_latency_ms == 1000


def test_get_summary_stats(sample_log_entries):
    """Test getting summary statistics."""
    analyzer = LogAnalyzer(sample_log_entries)
    stats = analyzer.get_summary_stats()

    assert stats["total_traces"] == 3
    assert stats["total_operations"] == 14
    assert stats["total_log_entries"] == 2
    assert stats["consumer_counts"]["process-spans-6"] == 2


def test_trace_stats_duration_property():
    """Test duration calculation."""
    stats = TraceStats(
        project_id="123",
        trace_id="abc",
        total_latency_ms=1000,
        total_count=10,
        log_entries=2,
        first_seen=datetime(2026, 2, 3, 18, 54, 0, tzinfo=timezone.utc),
        last_seen=datetime(2026, 2, 3, 18, 55, 30, tzinfo=timezone.utc),
    )

    assert stats.duration == "0:01:30"
