"""
Unit tests for GCP Log Analyzer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from sentry.spans.gcp_log_analyzer import (
    CLIFormatter,
    GCPLogFetcher,
    LogAnalyzer,
    LogEntry,
    MockLogFetcher,
    TraceOperation,
    TraceStats,
    build_gcp_filter,
    parse_top_slow_operations,
)
from sentry.utils import json


class TestParseTopSlowOperations:
    """Tests for parse_top_slow_operations function."""

    def test_parse_valid_operations(self):
        """Test parsing valid operation entries."""
        operations = [
            "4510228324352001:6a499a5de1f6e3b412adb0ef7600b3ee:2303:26557",
            "5471332:fc8dc7a8bee64349960bbc9481105d46:6:6",
        ]

        result = parse_top_slow_operations(operations)

        assert len(result) == 2
        assert result[0].project_id == "4510228324352001"
        assert result[0].trace_id == "6a499a5de1f6e3b412adb0ef7600b3ee"
        assert result[0].count == 2303
        assert result[0].cumulative_latency_ms == 26557

        assert result[1].project_id == "5471332"
        assert result[1].trace_id == "fc8dc7a8bee64349960bbc9481105d46"
        assert result[1].count == 6
        assert result[1].cumulative_latency_ms == 6

    def test_parse_malformed_operations(self):
        """Test parsing malformed operation entries."""
        operations = [
            "4510228324352001:6a499a5de1f6e3b412adb0ef7600b3ee:2303:26557",  # Valid
            "invalid:entry",  # Too few parts
            "a:b:c:d:e",  # Too many parts
            "1:2:not_a_number:4",  # Invalid count
            "1:2:3:not_a_number",  # Invalid latency
        ]

        result = parse_top_slow_operations(operations)

        # Should only parse the valid one
        assert len(result) == 1
        assert result[0].project_id == "4510228324352001"

    def test_parse_empty_list(self):
        """Test parsing empty operations list."""
        result = parse_top_slow_operations([])
        assert len(result) == 0


class TestBuildGCPFilter:
    """Tests for build_gcp_filter function."""

    def test_basic_filter(self):
        """Test basic filter without optional parameters."""
        result = build_gcp_filter()

        assert 'jsonPayload.event="spans.buffer.slow_evalsha_operations"' in result
        assert 'resource.labels.project_id="sentry-s4s2"' in result

    def test_filter_with_time_range(self):
        """Test filter with time range."""
        start = datetime(2026, 2, 3, 18, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 2, 3, 19, 0, 0, tzinfo=timezone.utc)

        result = build_gcp_filter(start_time=start, end_time=end)

        assert "timestamp>=" in result
        assert "2026-02-03T18:00:00" in result
        assert "2026-02-03T19:00:00" in result

    def test_filter_with_consumer(self):
        """Test filter with consumer parameter."""
        result = build_gcp_filter(consumer="process-spans-6")

        assert 'labels."k8s-pod/consumer"="process-spans-6"' in result

    def test_custom_gcp_project(self):
        """Test filter with custom GCP project."""
        result = build_gcp_filter(gcp_project="custom-project")

        assert 'resource.labels.project_id="custom-project"' in result


class TestMockLogFetcher:
    """Tests for MockLogFetcher class."""

    @pytest.fixture
    def sample_log_data(self, tmp_path):
        """Create a sample log JSON file."""
        data = [
            {
                "timestamp": "2026-02-03T18:54:36.806983608Z",
                "labels": {"k8s-pod/consumer": "process-spans-6"},
                "jsonPayload": {
                    "event": "spans.buffer.slow_evalsha_operations",
                    "top_slow_operations": [
                        "4505130643619840:d07196f0e9b043bf8e7ad7b94946e90e:4:6",
                        "6743973:b92ecf47d1bd076445f6925a2f691776:5:5",
                    ],
                },
            },
            {
                "timestamp": "2026-02-03T18:54:37.254512487Z",
                "labels": {"k8s-pod/consumer": "process-spans-7"},
                "jsonPayload": {
                    "event": "spans.buffer.slow_evalsha_operations",
                    "top_slow_operations": [
                        "4504956077735936:901319b2275b41538725f281cb3d919e:3:4",
                    ],
                },
            },
        ]

        file_path = tmp_path / "test_logs.json"
        with open(file_path, "w") as f:
            json.dump(data, f)

        return str(file_path)

    def test_fetch_all_logs(self, sample_log_data):
        """Test fetching all logs without filters."""
        fetcher = MockLogFetcher(sample_log_data)
        logs = fetcher.fetch_logs()

        assert len(logs) == 2
        assert logs[0].consumer == "process-spans-6"
        assert len(logs[0].operations) == 2
        assert logs[1].consumer == "process-spans-7"
        assert len(logs[1].operations) == 1

    def test_filter_by_consumer(self, sample_log_data):
        """Test filtering by consumer."""
        fetcher = MockLogFetcher(sample_log_data)
        logs = fetcher.fetch_logs(consumer="process-spans-6")

        assert len(logs) == 1
        assert logs[0].consumer == "process-spans-6"

    def test_filter_by_time_range(self, sample_log_data):
        """Test filtering by time range."""
        fetcher = MockLogFetcher(sample_log_data)

        start = datetime(2026, 2, 3, 18, 54, 37, tzinfo=timezone.utc)
        end = datetime(2026, 2, 3, 18, 55, 0, tzinfo=timezone.utc)

        logs = fetcher.fetch_logs(start_time=start, end_time=end)

        # Should only get the second log entry
        assert len(logs) == 1
        assert logs[0].consumer == "process-spans-7"


class TestLogAnalyzer:
    """Tests for LogAnalyzer class."""

    @pytest.fixture
    def sample_log_entries(self):
        """Create sample log entries for testing."""
        return [
            LogEntry(
                timestamp=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                consumer="process-spans-6",
                operations=[
                    TraceOperation("4505130643619840", "trace-a", 4, 600),
                    TraceOperation("6743973", "trace-b", 5, 500),
                ],
            ),
            LogEntry(
                timestamp=datetime(2026, 2, 3, 18, 54, 37, tzinfo=timezone.utc),
                consumer="process-spans-6",
                operations=[
                    TraceOperation("4505130643619840", "trace-a", 2, 400),  # Same trace
                    TraceOperation("9999999", "trace-c", 3, 300),
                ],
            ),
        ]

    def test_aggregate_traces(self, sample_log_entries):
        """Test aggregating traces across log entries."""
        analyzer = LogAnalyzer(sample_log_entries)
        traces = analyzer.aggregate_traces()

        # Should have 3 unique traces
        assert len(traces) == 3

        # Check the aggregated trace that appears twice
        key = ("4505130643619840", "trace-a")
        assert key in traces
        trace_a = traces[key]
        assert trace_a.total_latency_ms == 1000  # 600 + 400
        assert trace_a.total_count == 6  # 4 + 2
        assert trace_a.log_entries == 2

    def test_filter_by_project(self, sample_log_entries):
        """Test filtering by project ID."""
        analyzer = LogAnalyzer(sample_log_entries)
        filtered = analyzer.filter_by_project("4505130643619840")

        # Should only have operations from that project
        assert len(filtered.log_entries) == 2
        assert all(
            op.project_id == "4505130643619840"
            for entry in filtered.log_entries
            for op in entry.operations
        )

    def test_filter_by_trace(self, sample_log_entries):
        """Test filtering by trace ID."""
        analyzer = LogAnalyzer(sample_log_entries)
        filtered = analyzer.filter_by_trace("trace-a")

        # Should only have operations from that trace
        assert len(filtered.log_entries) == 2
        assert all(
            op.trace_id == "trace-a" for entry in filtered.log_entries for op in entry.operations
        )

    def test_get_top_traces(self, sample_log_entries):
        """Test getting top traces by latency."""
        analyzer = LogAnalyzer(sample_log_entries)
        top_traces = analyzer.get_top_traces(limit=2)

        assert len(top_traces) == 2
        # Should be sorted by latency descending
        assert top_traces[0].total_latency_ms >= top_traces[1].total_latency_ms
        assert top_traces[0].total_latency_ms == 1000  # trace-a

    def test_get_summary_stats(self, sample_log_entries):
        """Test getting summary statistics."""
        analyzer = LogAnalyzer(sample_log_entries)
        stats = analyzer.get_summary_stats()

        assert stats["total_traces"] == 3
        assert stats["total_operations"] == 14  # 4+5+2+3
        assert stats["total_log_entries"] == 2
        assert stats["consumer_counts"]["process-spans-6"] == 2

    def test_empty_log_entries(self):
        """Test analyzer with empty log entries."""
        analyzer = LogAnalyzer([])
        traces = analyzer.aggregate_traces()

        assert len(traces) == 0

        stats = analyzer.get_summary_stats()
        assert stats["total_traces"] == 0
        assert stats["total_operations"] == 0


class TestCLIFormatter:
    """Tests for CLIFormatter class."""

    def test_format_trace_table(self):
        """Test formatting trace table."""
        traces = [
            TraceStats(
                project_id="4510228324352001",
                trace_id="6a499a5de1f6e3b412adb0ef7600b3ee",
                total_latency_ms=26557,
                total_count=2303,
                log_entries=1,
                first_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                last_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            ),
            TraceStats(
                project_id="5471332",
                trace_id="fc8dc7a8bee64349960bbc9481105d46",
                total_latency_ms=6,
                total_count=6,
                log_entries=1,
                first_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
                last_seen=datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            ),
        ]

        formatter = CLIFormatter()
        result = formatter.format_trace_table(traces)

        assert "Top Traces by Cumulative Latency" in result
        assert "4510228324352001" in result
        assert "26,557 ms" in result
        assert "2,303" in result

    def test_format_empty_traces(self):
        """Test formatting empty trace list."""
        formatter = CLIFormatter()
        result = formatter.format_trace_table([])

        assert "No traces found" in result

    def test_format_summary(self):
        """Test formatting summary statistics."""
        stats = {
            "total_traces": 2,
            "total_operations": 2309,
            "total_log_entries": 20,
            "time_range_start": datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc),
            "time_range_end": datetime(2026, 2, 3, 18, 54, 37, tzinfo=timezone.utc),
            "consumer_counts": {"process-spans-6": 20},
        }

        formatter = CLIFormatter()
        result = formatter.format_summary(stats)

        assert "Total traces: 2" in result
        assert "Total operations: 2,309" in result
        assert "process-spans-6 (20)" in result


class TestTraceStats:
    """Tests for TraceStats dataclass."""

    def test_duration_property(self):
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

        # 1 minute 30 seconds
        assert stats.duration == "0:01:30"

    def test_duration_zero(self):
        """Test duration when first_seen equals last_seen."""
        time = datetime(2026, 2, 3, 18, 54, 0, tzinfo=timezone.utc)
        stats = TraceStats(
            project_id="123",
            trace_id="abc",
            total_latency_ms=1000,
            total_count=10,
            log_entries=1,
            first_seen=time,
            last_seen=time,
        )

        assert stats.duration == "0:00:00"


class TestGCPLogFetcher:
    """Tests for GCPLogFetcher class."""

    def test_fetch_logs_with_filters(self):
        """Test fetching logs with filters applied."""
        # Skip if google-cloud-logging is not installed
        try:
            import google.cloud.logging as gcp_logging
        except ImportError:
            pytest.skip("google-cloud-logging not installed")

        with patch.object(gcp_logging, "Client") as mock_client_class:
            # Mock the GCP client
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client

            # Mock log entries
            mock_entry = MagicMock()
            mock_entry.timestamp = datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc)
            mock_entry.labels = {"k8s-pod/consumer": "process-spans-6"}
            mock_entry.payload = {
                "top_slow_operations": ["4505130643619840:d07196f0e9b043bf8e7ad7b94946e90e:4:6"]
            }
            mock_client.list_entries.return_value = [mock_entry]

            # Create fetcher and fetch logs
            fetcher = GCPLogFetcher("test-project")
            start = datetime(2026, 2, 3, 18, 0, 0, tzinfo=timezone.utc)
            end = datetime(2026, 2, 3, 19, 0, 0, tzinfo=timezone.utc)

            logs = fetcher.fetch_logs(start_time=start, end_time=end, consumer="process-spans-6")

            # Verify client was called with correct filter
            mock_client.list_entries.assert_called_once()
            call_kwargs = mock_client.list_entries.call_args[1]
            assert "process-spans-6" in call_kwargs["filter_"]
            assert "2026-02-03T18:00:00" in call_kwargs["filter_"]

            # Verify logs were parsed
            assert len(logs) == 1
            assert logs[0].consumer == "process-spans-6"
