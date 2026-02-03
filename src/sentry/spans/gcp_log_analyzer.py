"""
GCP Logging Parser for Span Buffer Operations

This script queries and analyzes slow EVALSHA operations logged by the span buffer system.
It can fetch logs from GCP Logging API or use mock data for testing.

Usage:
    # Fetch logs from last 60 minutes
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60

    # Filter by consumer (server-side filtering)
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60 --consumer "process-spans-6"

    # Filter by project ID (client-side filtering)
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60 --project-id 4510228324352001

    # Use mock data for testing
    python -m sentry.spans.gcp_log_analyzer fetch --mock-file logs.json --last-minutes 60
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from dateutil import parser as dateutil_parser

from sentry.utils import json

logger = logging.getLogger(__name__)

PAGE_SIZE = 10000


@dataclass
class TraceOperation:
    """Parsed operation from top_slow_operations field.

    Format: {project_id}:{trace_id}:{count}:{cumulative_latency_ms}
    Example: "4510228324352001:6a499a5de1f6e3b412adb0ef7600b3ee:2303:26557"
    """

    project_id: str
    trace_id: str
    count: int
    cumulative_latency_ms: int


@dataclass
class LogEntry:
    """Parsed representation of a single GCP log entry."""

    timestamp: datetime
    consumer: str
    operations: list[TraceOperation]

    @property
    def consumer_name(self) -> str:
        """Extract consumer name for display."""
        return self.consumer if self.consumer else "unknown"


@dataclass
class TraceStats:
    """Aggregated statistics for a trace across multiple log entries."""

    project_id: str
    trace_id: str
    total_latency_ms: int
    total_count: int
    log_entries: int
    first_seen: datetime
    last_seen: datetime

    @property
    def duration(self) -> str:
        """Human-readable duration between first and last seen."""
        delta = self.last_seen - self.first_seen
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours}:{minutes:02d}:{seconds:02d}"


def parse_top_slow_operations(operations_list: list[str]) -> list[TraceOperation]:
    """Parse top_slow_operations entries.

    Format: {project_id}:{trace_id}:{count}:{cumulative_latency_ms}

    Args:
        operations_list: List of colon-delimited operation strings

    Returns:
        List of parsed TraceOperation objects
    """
    results = []
    for op_str in operations_list:
        try:
            parts = op_str.split(":")
            if len(parts) == 4:
                results.append(
                    TraceOperation(
                        project_id=parts[0],
                        trace_id=parts[1],
                        count=int(parts[2]),
                        cumulative_latency_ms=int(parts[3]),
                    )
                )
            else:
                logger.warning("Malformed operation entry (expected 4 parts): %s", op_str)
        except (ValueError, IndexError) as e:
            logger.warning("Failed to parse operation entry '%s': %s", op_str, e)
    return results


def build_gcp_filter(
    event_type: str = "spans.buffer.slow_evalsha_operations",
    gcp_project: str = "sentry-s4s2",
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    consumer: str | None = None,
) -> str:
    """Build GCP Logging API filter string.

    Only includes filters that can be applied server-side.
    project_id and trace_id must be filtered after fetching logs
    because they're nested in the top_slow_operations array.

    Args:
        event_type: Event type to filter (default: spans.buffer.slow_evalsha_operations)
        gcp_project: GCP project ID (default: sentry-s4s2)
        start_time: Start of time range
        end_time: End of time range
        consumer: Consumer name to filter by (e.g., "process-spans-6")

    Returns:
        GCP Logging API filter string
    """
    filters = [f'jsonPayload.event="{event_type}"', f'resource.labels.project_id="{gcp_project}"']

    # Server-side filters (reduces data transfer)
    if start_time and end_time:
        filters.append(f'timestamp>="{start_time.isoformat()}"')
        filters.append(f'timestamp<="{end_time.isoformat()}"')

    if consumer:
        # Consumer is a top-level label - can filter at API level
        filters.append(f'labels."k8s-pod/consumer"="{consumer}"')

    return " AND ".join(filters)


class MockLogFetcher:
    """Fetches logs from a local JSON file for testing."""

    def __init__(self, json_file_path: str):
        """Initialize with path to JSON file.

        Args:
            json_file_path: Path to JSON file containing log entries
        """
        self.json_file_path = json_file_path

    def fetch_logs(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        consumer: str | None = None,
    ) -> list[LogEntry]:
        """Fetch and parse logs from JSON file.

        Args:
            start_time: Start of time range (filters client-side)
            end_time: End of time range (filters client-side)
            consumer: Consumer name to filter by (filters client-side)

        Returns:
            List of parsed LogEntry objects
        """
        with open(self.json_file_path) as f:
            raw_entries = json.load(f)

        log_entries = []
        for entry in raw_entries:
            parsed_entry = self._parse_log_entry(entry)
            if parsed_entry:
                # Apply filters
                if start_time and parsed_entry.timestamp < start_time:
                    continue
                if end_time and parsed_entry.timestamp > end_time:
                    continue
                if consumer and parsed_entry.consumer != consumer:
                    continue
                log_entries.append(parsed_entry)

        return log_entries

    def _parse_log_entry(self, entry: dict[str, Any]) -> LogEntry | None:
        """Parse a single GCP log entry.

        Args:
            entry: Raw log entry dictionary

        Returns:
            Parsed LogEntry or None if parsing fails
        """
        try:
            # Parse timestamp
            timestamp_str = entry.get("timestamp", "")
            timestamp = dateutil_parser.isoparse(timestamp_str)

            # Extract consumer from labels
            labels = entry.get("labels", {})
            consumer = labels.get("k8s-pod/consumer", "")

            # Parse top_slow_operations
            json_payload = entry.get("jsonPayload", {})
            operations_list = json_payload.get("top_slow_operations", [])
            operations = parse_top_slow_operations(operations_list)

            return LogEntry(timestamp=timestamp, consumer=consumer, operations=operations)
        except (KeyError, ValueError) as e:
            logger.warning("Failed to parse log entry: %s", e)
            return None


class GCPLogFetcher:
    """Fetches logs from GCP Logging API."""

    def __init__(self, gcp_project: str = "sentry-s4s2"):
        """Initialize GCP log fetcher.

        Args:
            gcp_project: GCP project ID to query
        """
        self.gcp_project = gcp_project
        self._client = None

    @property
    def client(self):
        """Lazy-load GCP Logging client."""
        if self._client is None:
            try:
                from google.cloud import logging as gcp_logging

                self._client = gcp_logging.Client(project=self.gcp_project)
            except ImportError:
                raise ImportError(
                    "google-cloud-logging is required for GCP API access. "
                    "Install it with: pip install google-cloud-logging"
                )
        return self._client

    def fetch_logs(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        consumer: str | None = None,
        max_results: int = 10000,
    ) -> list[LogEntry]:
        """Fetch logs from GCP Logging API.

        Args:
            start_time: Start of time range
            end_time: End of time range
            consumer: Consumer name to filter by (server-side)
            max_results: Maximum number of log entries to fetch

        Returns:
            List of parsed LogEntry objects
        """
        from google.cloud import logging as gcp_logging

        # Build filter string
        filter_str = build_gcp_filter(
            gcp_project=self.gcp_project,
            start_time=start_time,
            end_time=end_time,
            consumer=consumer,
        )

        logger.info("Fetching logs with filter: %s", filter_str)

        # Fetch logs from API
        entries = self.client.list_entries(
            filter_=filter_str,
            order_by=gcp_logging.DESCENDING,
            max_results=max_results,
            page_size=PAGE_SIZE,
        )

        # Parse entries
        log_entries = []
        for entry in entries:
            parsed_entry = self._parse_log_entry(entry)
            if parsed_entry:
                log_entries.append(parsed_entry)

        logger.info("Fetched and parsed %d log entries", len(log_entries))
        return log_entries

    def _parse_log_entry(self, entry) -> LogEntry | None:
        """Parse a single GCP log entry from API.

        Args:
            entry: GCP log entry object

        Returns:
            Parsed LogEntry or None if parsing fails
        """
        try:
            # Parse timestamp
            timestamp = entry.timestamp

            # Extract consumer from labels
            consumer = entry.labels.get("k8s-pod/consumer", "")

            # Parse top_slow_operations
            json_payload = entry.payload
            operations_list = json_payload.get("top_slow_operations", [])
            operations = parse_top_slow_operations(operations_list)

            return LogEntry(timestamp=timestamp, consumer=consumer, operations=operations)
        except (AttributeError, KeyError, ValueError) as e:
            logger.warning("Failed to parse log entry: %s", e)
            return None


class LogAnalyzer:
    """Analyzes and aggregates log entries."""

    def __init__(self, log_entries: list[LogEntry]):
        """Initialize analyzer with log entries.

        Args:
            log_entries: List of parsed log entries
        """
        self.log_entries = log_entries
        self._trace_stats: dict[tuple[str, str], TraceStats] | None = None

    def filter_by_project(self, project_id: str) -> LogAnalyzer:
        """Filter operations by project ID (client-side filtering).

        Args:
            project_id: Project ID to filter by

        Returns:
            New LogAnalyzer with filtered entries
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.operations if op.project_id == project_id]
            if filtered_ops:
                filtered_entries.append(
                    LogEntry(
                        timestamp=entry.timestamp, consumer=entry.consumer, operations=filtered_ops
                    )
                )
        return LogAnalyzer(filtered_entries)

    def filter_by_trace(self, trace_id: str) -> LogAnalyzer:
        """Filter operations by trace ID (client-side filtering).

        Args:
            trace_id: Trace ID to filter by

        Returns:
            New LogAnalyzer with filtered entries
        """
        filtered_entries = []
        for entry in self.log_entries:
            filtered_ops = [op for op in entry.operations if op.trace_id == trace_id]
            if filtered_ops:
                filtered_entries.append(
                    LogEntry(
                        timestamp=entry.timestamp, consumer=entry.consumer, operations=filtered_ops
                    )
                )
        return LogAnalyzer(filtered_entries)

    def aggregate_traces(self) -> dict[tuple[str, str], TraceStats]:
        """Aggregate traces across log entries.

        Groups by (project_id, trace_id) and sums latency/count.

        Returns:
            Dictionary mapping (project_id, trace_id) to TraceStats
        """
        if self._trace_stats is not None:
            return self._trace_stats

        trace_data: dict[tuple[str, str], dict[str, Any]] = defaultdict(
            lambda: {
                "total_latency_ms": 0,
                "total_count": 0,
                "log_entries": 0,
                "first_seen": None,
                "last_seen": None,
            }
        )

        for entry in self.log_entries:
            for op in entry.operations:
                key = (op.project_id, op.trace_id)
                stats = trace_data[key]

                stats["total_latency_ms"] += op.cumulative_latency_ms
                stats["total_count"] += op.count
                stats["log_entries"] += 1

                if stats["first_seen"] is None or entry.timestamp < stats["first_seen"]:
                    stats["first_seen"] = entry.timestamp
                if stats["last_seen"] is None or entry.timestamp > stats["last_seen"]:
                    stats["last_seen"] = entry.timestamp

        # Convert to TraceStats objects
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
        """Get top N traces by total latency.

        Args:
            limit: Maximum number of traces to return

        Returns:
            List of TraceStats sorted by total latency (descending)
        """
        traces = list(self.aggregate_traces().values())
        traces.sort(key=lambda t: t.total_latency_ms, reverse=True)
        return traces[:limit]

    def get_summary_stats(self) -> dict[str, Any]:
        """Get summary statistics across all log entries.

        Returns:
            Dictionary of summary statistics
        """
        traces = self.aggregate_traces()

        total_traces = len(traces)
        total_operations = sum(t.total_count for t in traces.values())
        total_log_entries = len(self.log_entries)

        # Time range
        if self.log_entries:
            timestamps = [e.timestamp for e in self.log_entries]
            time_range_start = min(timestamps)
            time_range_end = max(timestamps)
        else:
            time_range_start = None
            time_range_end = None

        # Consumer breakdown
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


class CLIFormatter:
    """Formats output for command-line display."""

    @staticmethod
    def format_trace_table(traces: list[TraceStats]) -> str:
        """Format traces as aligned columns.

        Args:
            traces: List of TraceStats to display

        Returns:
            Formatted table string
        """
        if not traces:
            return "No traces found."

        lines = []
        lines.append("Top Traces by Cumulative Latency")
        lines.append("=" * 120)
        lines.append("")

        # Header
        header = (
            f"{'Project ID':<20} "
            f"{'Trace ID':<34} "
            f"{'Total Latency':>15} "
            f"{'Operations':>12} "
            f"{'Log Entries':>12} "
            f"{'Duration':>10}"
        )
        lines.append(header)
        lines.append("-" * 120)

        # Rows
        for trace in traces:
            row = (
                f"{trace.project_id:<20} "
                f"{trace.trace_id:<34} "
                f"{trace.total_latency_ms:>13,} ms "
                f"{trace.total_count:>12,} "
                f"{trace.log_entries:>12} "
                f"{trace.duration:>10}"
            )
            lines.append(row)

        return "\n".join(lines)

    @staticmethod
    def format_summary(stats: dict[str, Any]) -> str:
        """Format summary statistics.

        Args:
            stats: Summary statistics dictionary

        Returns:
            Formatted summary string
        """
        lines = []
        lines.append("")
        lines.append("Summary:")
        lines.append(f"- Total traces: {stats['total_traces']:,}")
        lines.append(f"- Total operations: {stats['total_operations']:,}")
        lines.append(f"- Total log entries: {stats['total_log_entries']:,}")

        if stats["time_range_start"] and stats["time_range_end"]:
            start_str = stats["time_range_start"].strftime("%Y-%m-%d %H:%M:%S")
            end_str = stats["time_range_end"].strftime("%Y-%m-%d %H:%M:%S")
            lines.append(f"- Time range: {start_str} to {end_str}")

        if stats["consumer_counts"]:
            consumer_str = ", ".join(
                f"{name} ({count})" for name, count in sorted(stats["consumer_counts"].items())
            )
            lines.append(f"- Consumers: {consumer_str}")

        return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="GCP Logging Parser for Span Buffer Operations")

    # Time range options
    time_group = parser.add_mutually_exclusive_group(required=True)
    time_group.add_argument("--last-minutes", type=int, help="Fetch logs from the last N minutes")
    time_group.add_argument(
        "--time-range",
        nargs=2,
        metavar=("START", "END"),
        help="Fetch logs in time range (ISO format: 2026-02-03T18:00:00Z)",
    )

    # Data source options
    parser.add_argument("--mock-file", help="Use mock data from JSON file instead of GCP API")
    parser.add_argument(
        "--gcp-project",
        default=os.environ.get("GCP_PROJECT", "sentry-s4s2"),
        help="GCP project ID (default: sentry-s4s2)",
    )

    # Filter options
    parser.add_argument(
        "--consumer", help="Filter by consumer name (e.g., process-spans-6) - server-side"
    )
    parser.add_argument("--project-id", help="Filter by project ID - client-side")
    parser.add_argument("--trace-id", help="Filter by trace ID - client-side")

    # Output options
    parser.add_argument(
        "--limit", type=int, default=20, help="Maximum number of traces to display (default: 20)"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s: %(message)s"
    )

    # Calculate time range
    if args.last_minutes:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(minutes=args.last_minutes)
    else:
        start_time = dateutil_parser.isoparse(args.time_range[0])
        end_time = dateutil_parser.isoparse(args.time_range[1])

    logger.info("Fetching logs from %s to %s", start_time, end_time)

    # Fetch logs
    try:
        if args.mock_file:
            logger.info("Using mock data from %s", args.mock_file)
            fetcher = MockLogFetcher(args.mock_file)
            log_entries = fetcher.fetch_logs(
                start_time=start_time,
                end_time=end_time,
                consumer=args.consumer,
            )
        else:
            logger.info("Fetching from GCP API (project: %s)", args.gcp_project)
            fetcher = GCPLogFetcher(gcp_project=args.gcp_project)
            log_entries = fetcher.fetch_logs(
                start_time=start_time,
                end_time=end_time,
                consumer=args.consumer,
            )
    except Exception:
        logger.exception("Failed to fetch logs")
        return 1

    if not log_entries:
        logger.info("No log entries found matching the criteria.")
        return 0

    # Analyze logs
    analyzer = LogAnalyzer(log_entries)

    # Apply client-side filters
    if args.project_id:
        logger.info("Filtering by project ID: %s", args.project_id)
        analyzer = analyzer.filter_by_project(args.project_id)

    if args.trace_id:
        logger.info("Filtering by trace ID: %s", args.trace_id)
        analyzer = analyzer.filter_by_trace(args.trace_id)

    # Get top traces
    top_traces = analyzer.get_top_traces(limit=args.limit)
    summary_stats = analyzer.get_summary_stats()

    # Format and display results
    formatter = CLIFormatter()
    # Print to stdout for CLI output (allowed for CLI tools)
    sys.stdout.write(formatter.format_trace_table(top_traces) + "\n")
    sys.stdout.write(formatter.format_summary(summary_stats) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
