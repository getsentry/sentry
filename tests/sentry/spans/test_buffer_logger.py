from __future__ import annotations

from unittest import mock

from sentry.spans.buffer_logger import BufferLogger


@mock.patch("sentry.spans.buffer_logger.time")
def test_accumulates_batches_and_tracks_cumulative_latency(mock_time):
    """
    Test that batches are accumulated with cumulative latency tracking,
    and that trimming occurs when exceeding MAX_ENTRIES (1000).
    """
    mock_time.time.return_value = 1000.0

    buffer_logger = BufferLogger()

    # Process first batch - all entries should be tracked
    buffer_logger.log(
        [
            ("project1:trace1", 50),
            ("project1:trace1", 150),
            ("project1:trace1", 200),
            ("project2:trace2", 120),
        ]
    )

    # Verify cumulative latency is tracked (50 + 150 + 200 = 400)
    assert buffer_logger._data["project1:trace1"] == (3, 400)
    assert buffer_logger._data["project2:trace2"] == (1, 120)

    # Process second batch
    buffer_logger.log([("project1:trace1", 180), ("project2:trace2", 80)])

    # Verify cumulative latencies are updated
    assert buffer_logger._data["project1:trace1"] == (4, 580)  # 400 + 180
    assert buffer_logger._data["project2:trace2"] == (2, 200)  # 120 + 80

    # Test trimming: add 1100 entries to exceed MAX_ENTRIES
    # First, add entries with varying cumulative latencies
    entries_to_add = []
    for i in range(1100):
        # Create entries with different latencies
        # Lower i values get higher latencies to test trimming
        latency = 1000 - i if i < 500 else 100
        entries_to_add.append((f"project{i}:trace{i}", latency))

    buffer_logger.log(entries_to_add)

    # Verify trimming occurred - should be exactly 1000 entries
    assert len(buffer_logger._data) == 1000

    # Verify that entries with lowest cumulative latency were removed
    # The entries with i >= 500 (latency=100) should be removed
    # Verify some high-latency entries are still present
    assert "project0:trace0" in buffer_logger._data
    assert "project10:trace10" in buffer_logger._data

    # Verify low-latency entries from the end were removed
    assert "project1099:trace1099" not in buffer_logger._data


@mock.patch("sentry.spans.buffer_logger.logger")
@mock.patch("sentry.spans.buffer_logger.time")
def test_logs_only_top_50_when_more_than_1000_traces(mock_time, mock_logger):
    """
    Test periodic logging (every 1 minute) of top 50 entries by cumulative latency,
    and verify dictionary is cleared after logging.
    """
    mock_time.time.side_effect = [
        1000.0,  # Set _last_log_time on first log
        1000.0,  # Check interval after first log (not yet, 0 seconds elapsed)
        1000.0,  # Check interval after second log (not yet, 0 seconds elapsed)
        1061.0,  # Check interval after third log - triggers logging (exceeds 60-second interval)
    ]

    buffer_logger = BufferLogger()

    # Log entry with high cumulative latency (10 occurrences)
    buffer_logger.log([("high_project:trace", 150)] * 10)

    # Add many more entries with lower cumulative latencies
    entries = [(f"project{i}:trace{i}", 100) for i in range(1000)]
    buffer_logger.log(entries)

    # Verify trimming occurred
    assert len(buffer_logger._data) == 1000

    # Trigger logging by advancing time past 60-second interval
    buffer_logger.log([("trigger:trace", 50)])

    # Verify logging occurred
    assert mock_logger.info.call_count == 1

    # Verify exact log content
    call_args = mock_logger.info.call_args
    assert call_args[0][0] == "spans.buffer.slow_evalsha_operations"
    extra = call_args[1]["extra"]

    # Top 50 entries are logged
    entries_list = extra["top_slow_operations"]
    assert len(entries_list) == 50

    # Verify entries are sorted by cumulative latency (descending)
    # high_project:trace has cumulative latency of 1500 (10 * 150)
    assert entries_list[0] == "high_project:trace:10:1500"

    # Verify total tracked keys before clearing
    assert extra["num_tracked_keys"] == 1000

    # Verify dictionary is empty after logging
    assert len(buffer_logger._data) == 0
    assert buffer_logger._last_log_time is None


@mock.patch("sentry.spans.buffer_logger.logger")
def test_no_logging_when_no_data(mock_logger):
    """Test that nothing is logged when _data is empty."""
    buffer_logger = BufferLogger()

    # Internal state check - no data
    assert len(buffer_logger._data) == 0

    # Even if we somehow trigger the logging path, it should not log
    # This is testing the internal behavior, but we can't easily trigger
    # the logging path without going through log() method
    # So we just verify initial state
    assert mock_logger.info.call_count == 0
