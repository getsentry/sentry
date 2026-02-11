"""
GCP Logging Parser to identify the most impactful traces on Spans Buffer resources.

This script queries and analyzes slow EVALSHA operations logged by the span buffer system.
It can fetch logs from GCP Logging API or use mock data for testing.

Usage:
    # Fetch logs from last 60 minutes
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60

    # Filter by consumer (server-side filtering)
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60 --consumer "process-spans-6"

    # Filter by project ID (client-side filtering)
    python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60 --project-id 12312312312

    # Use mock data for testing
    python -m sentry.spans.gcp_log_analyzer fetch --mock-file logs.json --last-minutes 60
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

from dateutil import parser as dateutil_parser

from sentry.spans.log_analyzer import (
    LogAnalyzer,
    SummaryStats,
    TraceStats,
    fetch_logs_from_file,
    fetch_logs_from_gcp,
)

logger = logging.getLogger(__name__)


def format_trace_table(traces: list[TraceStats]) -> str:
    """
    Format traces as aligned columns for command-line display.
    """
    if not traces:
        return "No traces found."

    lines = []
    lines.append("Top Traces by Cumulative Latency")
    lines.append("=" * 120)
    lines.append("")

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


def format_summary(stats: SummaryStats) -> str:
    """
    Format summary statistics for command-line display.
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

    time_group = parser.add_mutually_exclusive_group(required=True)
    time_group.add_argument("--last-minutes", type=int, help="Fetch logs from the last N minutes")
    time_group.add_argument(
        "--time-range",
        nargs=2,
        metavar=("START", "END"),
        help="Fetch logs in time range (ISO format: 2026-02-03T18:00:00Z)",
    )

    parser.add_argument("--mock-file", help="Use mock data from JSON file instead of GCP API")
    parser.add_argument(
        "--gcp-project",
        default=os.environ.get("GCP_PROJECT"),
        help="GCP project ID (required)",
    )

    parser.add_argument(
        "--consumer", help="Filter by consumer name (e.g., process-spans-6) - server-side"
    )
    parser.add_argument("--project-id", help="Filter by trace project ID - client-side")
    parser.add_argument("--trace-id", help="Filter by trace ID - client-side")

    parser.add_argument(
        "--limit", type=int, default=20, help="Maximum number of traces to display (default: 20)"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    return parser.parse_args()


def main() -> int:
    """
    Main entrypoint for the GCP Log Analyzer.

    Fetches logs from the source chosen via CLI, filters client-side as requested,
    aggregates traces and prints a summary.
    """
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s: %(message)s"
    )

    if args.last_minutes:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(minutes=args.last_minutes)
    else:
        start_time = dateutil_parser.isoparse(args.time_range[0])
        end_time = dateutil_parser.isoparse(args.time_range[1])

    logger.info("Fetching logs from %s to %s", start_time, end_time)

    try:
        if args.mock_file:
            logger.info("Using mock data from %s", args.mock_file)
            log_entries = fetch_logs_from_file(
                args.mock_file,
                start_time=start_time,
                end_time=end_time,
                consumer=args.consumer,
            )
        else:
            logger.info("Fetching from GCP API (project: %s)", args.gcp_project)
            log_entries = fetch_logs_from_gcp(
                gcp_project=args.gcp_project,
                start_time=start_time,
                end_time=end_time,
                consumer=args.consumer,
            )
    except Exception:
        logger.exception("Failed to fetch logs")
        return -1

    if not log_entries:
        logger.info("No log entries found matching the criteria.")
        return 0

    analyzer = LogAnalyzer(log_entries)

    if args.project_id:
        logger.info("Filtering by project ID: %s", args.project_id)
        analyzer = analyzer.filter_by_project(args.project_id)

    if args.trace_id:
        logger.info("Filtering by trace ID: %s", args.trace_id)
        analyzer = analyzer.filter_by_trace(args.trace_id)

    top_traces = analyzer.get_top_traces(limit=args.limit)
    summary_stats = analyzer.get_summary_stats()

    sys.stdout.write(format_trace_table(top_traces) + "\n")
    sys.stdout.write(format_summary(summary_stats) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
