from __future__ import annotations

from unittest import mock

import pytest

from sentry.spans.buffer_logger import BufferLogger
from sentry.testutils.helpers.options import override_options


class TestBufferLogger:
    """Tests for BufferLogger class that tracks slow pipeline operations."""

    def test_does_not_log_below_threshold(self):
        """Test that operations below threshold are not recorded."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()
            keys = [("123:abc", "span1"), ("456:def", "span2")]

            # Latency below threshold should not be recorded
            logger.log(keys, latency_ms=50)

            assert len(logger._counts) == 0

    def test_logs_above_threshold(self):
        """Test that operations above threshold are recorded."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()
            keys = [("123:abc", "span1"), ("456:def", "span2")]

            # Latency above threshold should be recorded
            logger.log(keys, latency_ms=150)

            assert len(logger._counts) == 2
            assert logger._counts["123:abc"] == 1
            assert logger._counts["456:def"] == 1

    def test_increments_existing_counts(self):
        """Test that counts are incremented for repeated slow operations."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()
            keys = [("123:abc", "span1")]

            # Log the same key multiple times
            logger.log(keys, latency_ms=150)
            logger.log(keys, latency_ms=200)
            logger.log(keys, latency_ms=175)

            assert logger._counts["123:abc"] == 3

    def test_prunes_to_max_entries(self):
        """Test that map is pruned to keep only top 100 entries by count."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()

            # Add 101 unique entries with varying counts
            for i in range(101):
                # First 50 entries get count of 10, next 51 get count of 1
                count = 10 if i < 50 else 1
                for _ in range(count):
                    logger.log([(f"{i}:trace{i}", "span")], latency_ms=150)

            # Should have been pruned to 100 entries
            assert len(logger._counts) == 100

            # The top 50 entries (with count 10) should be preserved
            for i in range(50):
                assert f"{i}:trace{i}" in logger._counts
                assert logger._counts[f"{i}:trace{i}"] == 10

            # Some of the lower count entries should have been dropped
            low_count_entries = [key for key in logger._counts if logger._counts[key] == 1]
            assert len(low_count_entries) == 50

    def test_prune_to_top_n(self):
        """Test the _prune_to_top_n method directly."""
        logger = BufferLogger()
        logger._counts = {
            "high1": 10,
            "high2": 9,
            "high3": 8,
            "mid1": 5,
            "mid2": 4,
            "low1": 1,
            "low2": 2,
        }

        logger._prune_to_top_n(5)

        assert len(logger._counts) == 5
        assert "high1" in logger._counts
        assert "high2" in logger._counts
        assert "high3" in logger._counts
        assert "mid1" in logger._counts
        assert "mid2" in logger._counts
        assert "low1" not in logger._counts
        assert "low2" not in logger._counts

    def test_prune_to_top_n_no_op_when_below_limit(self):
        """Test that pruning is a no-op when entries are below limit."""
        logger = BufferLogger()
        logger._counts = {"key1": 5, "key2": 3}

        logger._prune_to_top_n(10)

        assert len(logger._counts) == 2
        assert logger._counts["key1"] == 5
        assert logger._counts["key2"] == 3

    @mock.patch("sentry.spans.buffer_logger.logger")
    @mock.patch("sentry.spans.buffer_logger.time")
    def test_periodic_logging_triggers_after_interval(self, mock_time, mock_logger):
        """Test that logging occurs after the configured interval."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            # Mock time to control when logging should trigger
            # Each log() call makes exactly 1 call to time.time()
            mock_time.time.side_effect = [
                1000.0,  # Initial time in __init__
                1000.0,  # First log call - check current time
                1006.0,  # Second log call - check current time (> 5s elapsed, triggers logging)
            ]

            logger = BufferLogger()
            keys = [("123:abc", "span1")]

            # First log - should not trigger periodic logging
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 0

            # Second log after 6 seconds - should trigger periodic logging
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 1

    @mock.patch("sentry.spans.buffer_logger.logger")
    @mock.patch("sentry.spans.buffer_logger.time")
    def test_logs_top_50_entries(self, mock_time, mock_logger):
        """Test that only top 50 entries are logged."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            # Calculate total number of log() calls
            # 60 entries with counts: 60, 59, 58, ..., 1 = sum(1 to 60) = 1830
            # Plus 1 final trigger call = 1831 total log() calls
            # Each log() call makes 1 time.time() call
            total_log_calls = sum(range(1, 61)) + 1  # 1831

            mock_time.time.side_effect = (
                [
                    1000.0,  # Initial time in __init__
                ]
                + [1000.0] * (total_log_calls - 1)
                + [  # All log calls except the last one
                    1006.0,  # Final trigger call that should trigger logging
                ]
            )

            logger = BufferLogger()

            # Add 60 entries with varying counts
            for i in range(60):
                count = 60 - i  # Descending counts so entry 0 has highest count
                for _ in range(count):
                    logger.log([(f"{i}:trace{i}", "span")], latency_ms=150)

            # Trigger periodic logging
            logger.log([("trigger:trace", "span")], latency_ms=150)

            # Should have logged
            assert mock_logger.info.call_count == 1

            # Check the logged data
            call_args = mock_logger.info.call_args
            assert call_args[0][0] == "spans.buffer.slow_evalsha_operations"
            extra = call_args[1]["extra"]

            # Should have logged top 50 entries
            assert extra["top_entries_count"] == 50
            assert extra["num_tracked_keys"] == 61  # 60 + 1 trigger

            # Verify the format includes entry counts
            entries_str = extra["top_slow_operations"]
            assert "0:trace0:60" in entries_str  # Highest count
            assert "49:trace49:11" in entries_str  # 50th entry

    @mock.patch("sentry.spans.buffer_logger.logger")
    def test_no_logging_when_empty(self, mock_logger):
        """Test that nothing is logged when there are no entries."""
        logger = BufferLogger()
        logger._log_top_entries()

        assert mock_logger.info.call_count == 0

    @mock.patch("sentry.spans.buffer_logger.logger")
    @mock.patch("sentry.spans.buffer_logger.time")
    def test_resets_timer_after_logging(self, mock_time, mock_logger):
        """Test that the timer is reset after logging."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            # Each log() call makes exactly 1 call to time.time()
            mock_time.time.side_effect = [
                1000.0,  # Initial time in __init__
                1000.0,  # First log - check current time
                1006.0,  # Second log - triggers logging (>5s elapsed)
                1010.0,  # Third log - should not trigger (only 4s since last log at 1006)
                1012.0,  # Fourth log - should trigger (6s elapsed since 1006)
            ]

            logger = BufferLogger()
            keys = [("123:abc", "span1")]

            # First log
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 0

            # Second log - triggers logging
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 1
            assert logger._last_log_time == 1006.0

            # Third log - should not trigger (only 4s elapsed)
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 1

            # Fourth log - should trigger (6s elapsed)
            logger.log(keys, latency_ms=150)
            assert mock_logger.info.call_count == 2

    def test_handles_empty_keys_iterator(self):
        """Test that empty keys iterator is handled gracefully."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()
            keys = []

            logger.log(keys, latency_ms=150)

            assert len(logger._counts) == 0

    def test_multiple_keys_in_single_call(self):
        """Test that multiple keys in a single call are all recorded."""
        with override_options({"spans.buffer.evalsha-latency-threshold": 100}):
            logger = BufferLogger()
            keys = [
                ("123:abc", "span1"),
                ("456:def", "span2"),
                ("789:ghi", "span3"),
            ]

            logger.log(keys, latency_ms=150)

            assert len(logger._counts) == 3
            assert logger._counts["123:abc"] == 1
            assert logger._counts["456:def"] == 1
            assert logger._counts["789:ghi"] == 1


@pytest.mark.parametrize(
    "threshold,latency,should_record",
    [
        (100, 99, False),  # Below threshold - no record
        (100, 100, False),  # Equal to threshold - no record
        (100, 101, True),  # Above threshold - record
        (50, 75, True),  # Above threshold - record
        (200, 150, False),  # Below threshold - no record
    ],
)
def test_threshold_boundary_conditions(threshold, latency, should_record):
    """Test various threshold and latency combinations.

    Only records when latency is strictly greater than the threshold.
    """
    with override_options({"spans.buffer.evalsha-latency-threshold": threshold}):
        logger = BufferLogger()
        keys = [("123:abc", "span1")]

        logger.log(keys, latency_ms=latency)

        if should_record:
            assert len(logger._counts) == 1
            assert logger._counts["123:abc"] == 1
        else:
            assert len(logger._counts) == 0
