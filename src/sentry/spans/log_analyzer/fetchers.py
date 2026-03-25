from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from dateutil import parser as dateutil_parser

from sentry.utils import json

logger = logging.getLogger(__name__)

PAGE_SIZE = 10000


BUFFER_LOG_MESSAGE = "spans.buffer.slow_evalsha_operations"
FLUSHER_LOG_MESSAGE = "spans.buffer.top_flush_operations_by_bytes"


@dataclass
class TraceSpans:
    """Parsed operation from top_slow_operations field.

    Format: {project_id}:{trace_id}:{count}:{cumulative_latency_ms}
    Example: "123123123:6a499a5de1f6e3b412adb0ef12345678:2303:26557"
    """

    project_id: str
    trace_id: str
    count: int
    cumulative_latency_ms: int


@dataclass
class FlusherTraceData:
    """Parsed operation from top_flush_operations field.

    Format: {project_id}:{trace_id}:{segment_count}:{span_count}:{bytes_flushed}
    Example: "123123123:6a499a5de1f6e3b412adb0ef12345678:5:200:50000"
    """

    project_id: str
    trace_id: str
    segment_count: int
    span_count: int
    bytes_flushed: int


@dataclass
class LogEntry:
    """Parsed representation of a single GCP log entry."""

    timestamp: datetime
    consumer: str
    traces: list[TraceSpans]

    @property
    def consumer_name(self) -> str:
        """Extract consumer name for display."""
        return self.consumer if self.consumer else "unknown"


@dataclass
class FlusherLogEntry:
    """Parsed representation of a single GCP flusher log entry."""

    timestamp: datetime
    consumer: str
    traces: list[FlusherTraceData]
    cumulative_load_ids_latency_ms: int = 0
    cumulative_load_data_latency_ms: int = 0
    cumulative_decompress_latency_ms: int = 0

    @property
    def consumer_name(self) -> str:
        """Extract consumer name for display."""
        return self.consumer if self.consumer else "unknown"


def parse_top_traces(operations_list: list[str]) -> list[TraceSpans]:
    """Parse top_slow_operations entries.

    Format: {project_id}:{trace_id}:{count}:{cumulative_latency_ms}

    Returns:
        List of parsed TraceSpans objects
    """
    results = []
    for op_str in operations_list:
        try:
            parts = op_str.split(":")
            if len(parts) == 4:
                results.append(
                    TraceSpans(
                        project_id=parts[0],
                        trace_id=parts[1],
                        count=int(parts[2]),
                        cumulative_latency_ms=int(parts[3]),
                    )
                )
            else:
                logger.warning("Malformed trace entry (expected 4 parts): %s", op_str)
        except (ValueError, IndexError) as e:
            logger.warning("Failed to parse trace entry '%s': %s", op_str, e)
    return results


def parse_top_flush_operations(operations_list: list[str]) -> list[FlusherTraceData]:
    """Parse top_flush_operations entries.

    Format: {project_id}:{trace_id}:{segment_count}:{span_count}:{bytes_flushed}

    Returns:
        List of parsed FlusherTraceData objects
    """
    results = []
    for op_str in operations_list:
        try:
            parts = op_str.split(":")
            if len(parts) == 5:
                results.append(
                    FlusherTraceData(
                        project_id=parts[0],
                        trace_id=parts[1],
                        segment_count=int(parts[2]),
                        span_count=int(parts[3]),
                        bytes_flushed=int(parts[4]),
                    )
                )
            else:
                logger.warning("Malformed flusher trace entry (expected 5 parts): %s", op_str)
        except (ValueError, IndexError) as e:
            logger.warning("Failed to parse flusher trace entry '%s': %s", op_str, e)
    return results


def fetch_logs_from_file(
    json_file_path: str,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    consumer: str | None = None,
    log_type: str = "buffer",
) -> list[LogEntry] | list[FlusherLogEntry]:
    """Fetch and parse logs from a local JSON file.

    Args:
        json_file_path: Path to JSON file containing log entries
        start_time: Start of time range (filters client-side)
        end_time: End of time range (filters client-side)
        consumer: Consumer name to filter by (filters client-side)
        log_type: Type of log to parse ("buffer" or "flusher")

    Returns:
        List of parsed LogEntry or FlusherLogEntry objects
    """
    with open(json_file_path) as f:
        raw_entries = json.load(f)

    if log_type == "flusher":
        return _parse_flusher_file_entries(raw_entries, start_time, end_time, consumer)
    return _parse_buffer_file_entries(raw_entries, start_time, end_time, consumer)


def _parse_buffer_file_entries(
    raw_entries: list[dict],
    start_time: datetime | None,
    end_time: datetime | None,
    consumer: str | None,
) -> list[LogEntry]:
    log_entries = []
    for entry in raw_entries:
        timestamp_str = entry.get("timestamp", "")
        timestamp = dateutil_parser.isoparse(timestamp_str)
        labels = entry.get("labels", {})
        entry_consumer = labels.get("k8s-pod/consumer", "")
        json_payload = entry.get("jsonPayload", {})
        operations_list = json_payload.get("top_slow_operations", [])

        operations = parse_top_traces(operations_list)

        if start_time and timestamp < start_time:
            continue
        if end_time and timestamp > end_time:
            continue
        if consumer and entry_consumer != consumer:
            continue
        log_entries.append(
            LogEntry(timestamp=timestamp, consumer=entry_consumer, traces=operations)
        )

    return log_entries


def _parse_flusher_file_entries(
    raw_entries: list[dict],
    start_time: datetime | None,
    end_time: datetime | None,
    consumer: str | None,
) -> list[FlusherLogEntry]:
    log_entries = []
    for entry in raw_entries:
        timestamp_str = entry.get("timestamp", "")
        timestamp = dateutil_parser.isoparse(timestamp_str)
        labels = entry.get("labels", {})
        entry_consumer = labels.get("k8s-pod/consumer", "")
        json_payload = entry.get("jsonPayload", {})
        operations_list = json_payload.get("top_flush_operations", [])

        operations = parse_top_flush_operations(operations_list)

        if start_time and timestamp < start_time:
            continue
        if end_time and timestamp > end_time:
            continue
        if consumer and entry_consumer != consumer:
            continue
        log_entries.append(
            FlusherLogEntry(
                timestamp=timestamp,
                consumer=entry_consumer,
                traces=operations,
                cumulative_load_ids_latency_ms=int(
                    json_payload.get("cumulative_load_ids_latency_ms", 0)
                ),
                cumulative_load_data_latency_ms=int(
                    json_payload.get("cumulative_load_data_latency_ms", 0)
                ),
                cumulative_decompress_latency_ms=int(
                    json_payload.get("cumulative_decompress_latency_ms", 0)
                ),
            )
        )

    return log_entries


def build_gcp_filter(
    event_type: str = BUFFER_LOG_MESSAGE,
    gcp_project: str = "sentry-s4s2",
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    consumer: str | None = None,
    pod: str | None = None,
) -> str:
    """Build GCP Logging API filter string.

    Only includes filters that can be applied server-side.
    project_id and trace_id must be filtered after fetching logs
    because they're nested in the operations array.

    Args:
        event_type: Event type to filter (default: spans.buffer.slow_evalsha_operations)
        gcp_project: GCP project ID (default: sentry-s4s2)
        start_time: Start of time range
        end_time: End of time range
        consumer: Consumer name to filter by (e.g., "process-spans")
        pod: Pod name to filter by (e.g., "getsentry-consumer-process-spans-production-6cbd74fb55-cqpvc")

    Returns:
        GCP Logging API filter string
    """
    filters = [f'jsonPayload.event="{event_type}"', f'resource.labels.project_id="{gcp_project}"']

    if start_time and end_time:
        filters.append(f'timestamp>="{start_time.isoformat()}"')
        filters.append(f'timestamp<="{end_time.isoformat()}"')

    if consumer:
        filters.append(f'labels."k8s-pod/consumer"="{consumer}"')

    if pod:
        filters.append(f'resource.labels.pod_name="{pod}"')

    return " AND ".join(filters)


def fetch_logs_from_gcp(
    gcp_project: str = "sentry-s4s2",
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    consumer: str | None = None,
    pod: str | None = None,
    max_results: int = 10000,
    log_type: str = "buffer",
) -> list[LogEntry] | list[FlusherLogEntry]:
    """Fetch logs from GCP Logging API.

    Args:
        gcp_project: GCP project ID to query
        start_time: Start of time range
        end_time: End of time range
        consumer: Consumer name to filter by (server-side)
        pod: Pod name to filter by (server-side)
        max_results: Maximum number of log entries to fetch
        log_type: Type of log to fetch ("buffer" or "flusher")

    Returns:
        List of parsed LogEntry or FlusherLogEntry objects
    """
    try:
        from google.cloud import logging as gcp_logging
    except ImportError:
        raise ImportError(
            "google-cloud-logging is required for GCP API access. "
            "Install it with: pip install google-cloud-logging"
        )

    event_type = BUFFER_LOG_MESSAGE if log_type == "buffer" else FLUSHER_LOG_MESSAGE

    client = gcp_logging.Client(project=gcp_project)

    filter_str = build_gcp_filter(
        event_type=event_type,
        gcp_project=gcp_project,
        start_time=start_time,
        end_time=end_time,
        consumer=consumer,
        pod=pod,
    )

    logger.info("Fetching %s logs with filter: %s", log_type, filter_str)

    entries = client.list_entries(
        filter_=filter_str,
        order_by=gcp_logging.DESCENDING,
        max_results=max_results,
        page_size=PAGE_SIZE,
    )

    if log_type == "flusher":
        return _parse_flusher_gcp_entries(entries)
    return _parse_buffer_gcp_entries(entries)


def _parse_buffer_gcp_entries(entries: Iterable[Any]) -> list[LogEntry]:
    log_entries = []
    for entry in entries:
        timestamp = entry.timestamp
        entry_consumer = entry.labels.get("k8s-pod/consumer", "")
        operations_list = entry.payload.get("top_slow_operations", [])
        operations = parse_top_traces(operations_list)
        log_entries.append(
            LogEntry(timestamp=timestamp, consumer=entry_consumer, traces=operations)
        )

    logger.info("Fetched and parsed %d buffer log entries", len(log_entries))
    return log_entries


def _parse_flusher_gcp_entries(entries: Iterable[Any]) -> list[FlusherLogEntry]:
    log_entries = []
    for entry in entries:
        timestamp = entry.timestamp
        entry_consumer = entry.labels.get("k8s-pod/consumer", "")
        payload = entry.payload
        operations_list = payload.get("top_flush_operations", [])
        operations = parse_top_flush_operations(operations_list)
        log_entries.append(
            FlusherLogEntry(
                timestamp=timestamp,
                consumer=entry_consumer,
                traces=operations,
                cumulative_load_ids_latency_ms=int(
                    payload.get("cumulative_load_ids_latency_ms", 0)
                ),
                cumulative_load_data_latency_ms=int(
                    payload.get("cumulative_load_data_latency_ms", 0)
                ),
                cumulative_decompress_latency_ms=int(
                    payload.get("cumulative_decompress_latency_ms", 0)
                ),
            )
        )

    logger.info("Fetched and parsed %d flusher log entries", len(log_entries))
    return log_entries
