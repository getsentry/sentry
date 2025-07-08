import logging
import unittest
from datetime import timedelta
from unittest.mock import Mock

from sentry.workflow_engine.processors.log_util import (
    _MAX_ITERATIONS_LOGGED,
    BatchPerformanceTracker,
    top_n_slowest,
)


class TestBatchPerformanceTracker(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.logger = Mock(spec=logging.Logger)
        self.time_func = Mock(return_value=0)
        self.tracker = BatchPerformanceTracker(
            "test_operation",
            self.logger,
            timedelta(seconds=100),
            time_func=self.time_func,
            extra={"my_key": 4},
        )

    def test_basic_tracking(self):
        """Test basic tracking functionality without exceeding threshold."""
        with self.tracker.track("item1"):
            self.time_func.return_value = 1  # Fast enough.

        self.tracker.finalize()
        self.logger.info.assert_not_called()

    def test_exceeds_threshold(self):
        """Test that logging occurs when total time exceeds threshold."""
        with self.tracker.track("item1"):
            self.time_func.return_value = 200  # Slow operation.

        self.tracker.finalize()
        self.logger.info.assert_called_once()
        call_args = self.logger.info.call_args[1]
        assert call_args["extra"]["total_duration"] == 200
        assert call_args["extra"]["durations"]["item1"] == 200
        assert call_args["extra"]["my_key"] == 4

    def test_multiple_items(self):
        """Test tracking multiple items and their cumulative duration."""
        with self.tracker.track("item1"):
            self.time_func.return_value = 50  # First item takes half the threshold.

        with self.tracker.track("item2"):
            self.time_func.return_value = (
                100  # Second item takes the other half, hitting threshold exactly.
            )

        self.tracker.finalize()
        self.logger.info.assert_called_once()
        call_args = self.logger.info.call_args
        assert call_args[0] == ("test_operation",)
        extra = call_args[1]["extra"]
        assert extra["durations"]["item1"] == 50
        assert extra["durations"]["item2"] == 50
        assert extra["total_duration"] == 100

    def test_key_collisions(self):
        """Test that durations are summed when the same key is used multiple times."""
        # First operation with key "item1"
        with self.tracker.track("item1"):
            self.time_func.return_value = 30

        # Second operation with same key
        with self.tracker.track("item1"):
            self.time_func.return_value = 70

        # Third operation with same key
        with self.tracker.track("item1"):
            self.time_func.return_value = 100

        self.tracker.finalize()
        self.logger.info.assert_called_once()
        call_args = self.logger.info.call_args[1]
        assert call_args["extra"]["durations"]["item1"] == 100  # 30 + 40 + 30
        assert call_args["extra"]["total_duration"] == 100

    def test_exception_handling(self):
        """Test that exceptions are logged if duration exceeds threshold."""
        # First do a fast operation
        with self.tracker.track("item1"):
            self.time_func.return_value = 1  # Fast operation.

        try:
            with self.tracker.track("item2"):
                self.time_func.return_value = 200  # Slow enough to exceed threshold.
                raise ValueError("Test exception")
        except ValueError:
            pass

        self.tracker.finalize()
        self.logger.info.assert_called_once()
        call_args = self.logger.info.call_args[1]
        assert call_args["extra"]["failure_key"] == "item2"
        assert call_args["extra"]["total_duration"] == 200
        assert call_args["extra"]["durations"]["item1"] == 1
        assert call_args["extra"]["durations"]["item2"] == 199

    def test_durations_truncated(self):
        """Test that durations_truncated is set correctly when there are too many iterations."""
        for i in range(_MAX_ITERATIONS_LOGGED + 100):
            with self.tracker.track(f"item_{i}"):
                self.time_func.return_value = i + 1

        self.tracker.finalize()
        self.logger.info.assert_called_once()
        call_args = self.logger.info.call_args[1]
        assert call_args["extra"]["durations_truncated"] == 100
        assert len(call_args["extra"]["durations"]) == _MAX_ITERATIONS_LOGGED


def test_top_n_slowest():
    durations: dict[str, float] = {"item1": 100, "item2": 50, "item3": 200, "item4": 150}
    assert top_n_slowest(durations, 0) == {}
    assert top_n_slowest(durations, 1) == {"item3": 200}
    assert top_n_slowest(durations, 2) == {"item3": 200, "item4": 150}
    assert top_n_slowest(durations, 3) == {"item1": 100, "item3": 200, "item4": 150}
    # n > len(durations)
    assert top_n_slowest(durations, 5) == durations
