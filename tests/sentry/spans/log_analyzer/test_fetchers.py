"""Tests for log_analyzer fetchers."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from sentry.spans.log_analyzer.fetchers import (
    build_gcp_filter,
    fetch_logs_from_file,
    fetch_logs_from_gcp,
    parse_top_traces,
)
from sentry.utils import json


def test_parse_top_traces_valid():
    """Test parsing valid trace entries."""
    operations = [
        "789789789:6a499a5de1f6e3b412adb0ef76009876:2303:26557",
        "1234567:fc8dc7a8bee64349960bbc9412345678:6:6",
    ]

    result = parse_top_traces(operations)

    assert len(result) == 2
    assert result[0].project_id == "789789789"
    assert result[0].trace_id == "6a499a5de1f6e3b412adb0ef76009876"
    assert result[0].count == 2303
    assert result[0].cumulative_latency_ms == 26557

    assert result[1].project_id == "1234567"
    assert result[1].trace_id == "fc8dc7a8bee64349960bbc9412345678"
    assert result[1].count == 6
    assert result[1].cumulative_latency_ms == 6


def test_parse_top_traces_empty_list():
    """Test parsing empty traces list."""
    result = parse_top_traces([])
    assert len(result) == 0


@pytest.mark.parametrize(
    "kwargs,expected_substrings",
    [
        (
            {},
            [
                'jsonPayload.event="spans.buffer.slow_evalsha_operations"',
                'resource.labels.project_id="sentry-s4s2"',
            ],
        ),
        (
            {
                "start_time": datetime(2026, 2, 3, 18, 0, 0, tzinfo=timezone.utc),
                "end_time": datetime(2026, 2, 3, 19, 0, 0, tzinfo=timezone.utc),
            },
            ["timestamp>=", "2026-02-03T18:00:00", "2026-02-03T19:00:00"],
        ),
        (
            {"consumer": "process-spans-6"},
            ['labels."k8s-pod/consumer"="process-spans-6"'],
        ),
        (
            {"gcp_project": "custom-project"},
            ['resource.labels.project_id="custom-project"'],
        ),
    ],
    ids=["basic", "time_range", "consumer", "custom_project"],
)
def test_build_gcp_filter(kwargs, expected_substrings):
    """Test build_gcp_filter with various arguments."""
    result = build_gcp_filter(**kwargs)
    for sub in expected_substrings:
        assert sub in result


@pytest.fixture
def sample_log_data(tmp_path):
    """Create a sample log JSON file."""
    data = [
        {
            "timestamp": "2026-02-03T18:54:36.806983608Z",
            "labels": {"k8s-pod/consumer": "process-spans-6"},
            "jsonPayload": {
                "event": "spans.buffer.slow_evalsha_operations",
                "top_slow_operations": [
                    "123123123123:d07196f0e9b043bf8e7ad7b949461234:4:6",
                    "456456:b92ecf47d1bd076445f6925a2f691776:5:5",
                ],
            },
        },
        {
            "timestamp": "2026-02-03T18:54:37.254512487Z",
            "labels": {"k8s-pod/consumer": "process-spans-7"},
            "jsonPayload": {
                "event": "spans.buffer.slow_evalsha_operations",
                "top_slow_operations": [
                    "567567567:901319b2275b41538725f281cb3d7689:3:4",
                ],
            },
        },
    ]

    file_path = tmp_path / "test_logs.json"
    with open(file_path, "w") as f:
        json.dump(data, f)

    return str(file_path)


def test_fetch_logs_from_file_all(sample_log_data):
    """Test fetching all logs without filters."""
    logs = fetch_logs_from_file(sample_log_data)

    assert len(logs) == 2
    assert logs[0].consumer == "process-spans-6"
    assert len(logs[0].traces) == 2
    assert logs[1].consumer == "process-spans-7"
    assert len(logs[1].traces) == 1


def test_fetch_logs_from_file_filter_by_consumer(sample_log_data):
    """Test filtering by consumer."""
    logs = fetch_logs_from_file(sample_log_data, consumer="process-spans-6")

    assert len(logs) == 1
    assert logs[0].consumer == "process-spans-6"


def test_fetch_logs_from_gcp_with_filters():
    """Test fetching logs with filters applied."""
    try:
        import google.cloud.logging as gcp_logging
    except ImportError:
        pytest.skip("google-cloud-logging not installed")

    with patch.object(gcp_logging, "Client") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        mock_entry = MagicMock()
        mock_entry.timestamp = datetime(2026, 2, 3, 18, 54, 36, tzinfo=timezone.utc)
        mock_entry.labels = {"k8s-pod/consumer": "process-spans-6"}
        mock_entry.payload = {
            "top_slow_operations": ["123123123123:d07196f0e9b043bf8e7ad7b949461234:4:6"]
        }
        mock_client.list_entries.return_value = [mock_entry]

        start = datetime(2026, 2, 3, 18, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 2, 3, 19, 0, 0, tzinfo=timezone.utc)

        logs = fetch_logs_from_gcp(
            gcp_project="test-project",
            start_time=start,
            end_time=end,
            consumer="process-spans-6",
        )

        mock_client.list_entries.assert_called_once()
        call_kwargs = mock_client.list_entries.call_args[1]
        assert "process-spans-6" in call_kwargs["filter_"]
        assert "2026-02-03T18:00:00" in call_kwargs["filter_"]

        assert len(logs) == 1
        assert logs[0].consumer == "process-spans-6"
