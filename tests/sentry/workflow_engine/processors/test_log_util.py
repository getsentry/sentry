import logging
import unittest
from datetime import timedelta
from unittest.mock import Mock

from sentry.workflow_engine.processors.log_util import (
    _MAX_ITERATIONS_LOGGED,
    BatchPerformanceTracker,
    log_extra_context,
    top_n_slowest,
    with_log_context,
)


class TestLogExtraContextWithRealLogger(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.logger = logging.getLogger("test_real_logger")
        self.logger.setLevel(logging.INFO)
        self.records = []
        self.handler = logging.Handler()
        self.handler.emit = lambda record: self.records.append(record)
        self.logger.addHandler(self.handler)

    def tearDown(self):
        super().tearDown()
        self.logger.removeHandler(self.handler)

    def test_real_logger_context(self):
        """Verify that context is properly applied to real LogRecords."""
        with log_extra_context(self.logger, project_id=123) as ctx:
            self.logger.info("test message")
            ctx.update(user_id=456)
            self.logger.info("test message 2")

        assert len(self.records) == 2

        # First record should have project_id
        first_record = self.records[0]
        assert first_record.project_id == 123
        assert not hasattr(first_record, "user_id")

        # Second record should have both project_id and user_id
        second_record = self.records[1]
        assert second_record.project_id == 123
        assert second_record.user_id == 456

    def test_real_logger_extra_override(self):
        """Verify that context doesn't override explicit extra values."""
        with log_extra_context(self.logger, project_id=123) as ctx:
            self.logger.info("test", extra={"project_id": 456})
            ctx.update(user_id=789)
            self.logger.info("test2", extra={"user_id": 0})

        assert len(self.records) == 2

        # First record should use explicit project_id
        first_record = self.records[0]
        assert first_record.project_id == 456

        # Second record should use explicit user_id
        second_record = self.records[1]
        assert second_record.user_id == 0
        assert second_record.project_id == 123  # Still from context

    def test_nested_contexts(self):
        """Verify that nested contexts work correctly with a real logger."""
        with log_extra_context(self.logger, current=1):
            self.logger.info("outer")
            with log_extra_context(self.logger, current=2) as ctx2:
                self.logger.info("inner")
                ctx2.update(current=3)
                self.logger.info("inner_updated")
            self.logger.info("outer_again")
        self.logger.info("outer_again_2")

        assert len(self.records) == 5

        first_record = self.records[0]
        assert first_record.current == 1

        second_record = self.records[1]
        assert second_record.current == 2

        third_record = self.records[2]
        assert third_record.current == 3

        # Fourth record should only have outer=1
        fourth_record = self.records[3]
        assert fourth_record.current == 1

        # Fifth record shouldn't have current
        fifth_record = self.records[4]
        assert not hasattr(fifth_record, "current")

    def test_with_log_context_decorator(self):
        """Verify that the with_log_context decorator works correctly."""

        @with_log_context(self.logger, initial=1)
        def process_item(ctx, item_id: int) -> None:
            self.logger.info("start", extra={"item_id": item_id})
            ctx.update(updated=2)
            self.logger.info("updated")
            return None

        process_item(123)

        assert len(self.records) == 2

        # First record should have initial=1 and item_id=123
        first_record = self.records[0]
        assert first_record.msg == "start"
        assert first_record.initial == 1
        assert first_record.item_id == 123

        # Second record should have initial=1, updated=2, and item_id=123
        second_record = self.records[1]
        assert second_record.msg == "updated"
        assert second_record.initial == 1
        assert second_record.updated == 2

    def test_with_log_context_decorator_nested(self):
        """Verify that nested decorated functions work correctly."""

        @with_log_context(self.logger, outer=1)
        def outer_func(ctx, x: int) -> None:
            self.logger.info("outer")
            inner_func(x)
            self.logger.info("outer_again")

        @with_log_context(self.logger, inner=2)
        def inner_func(ctx, x: int) -> None:
            self.logger.info("inner")
            ctx.update(inner_updated=3)
            self.logger.info("inner_updated")

        outer_func(123)

        assert len(self.records) == 4

        # First record should have outer=1
        first_record = self.records[0]
        assert first_record.outer == 1

        # Second record should have inner=2
        second_record = self.records[1]
        assert second_record.inner == 2

        # Third record should have inner=2 and inner_updated=3
        third_record = self.records[2]
        assert third_record.inner == 2
        assert third_record.inner_updated == 3

        # Fourth record should have outer=1
        fourth_record = self.records[3]
        assert fourth_record.outer == 1


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
        assert call_args["extra"]["durations_truncated"] == 100  # 300 - 200
        assert len(call_args["extra"]["durations"]) == 200  # Should only keep top 200


def test_top_n_slowest():
    durations: dict[str, float] = {"item1": 100, "item2": 50, "item3": 200, "item4": 150}
    assert top_n_slowest(durations, 0) == {}
    assert top_n_slowest(durations, 1) == {"item3": 200}
    assert top_n_slowest(durations, 2) == {"item3": 200, "item4": 150}
    assert top_n_slowest(durations, 3) == {"item1": 100, "item3": 200, "item4": 150}
    # n > len(durations)
    assert top_n_slowest(durations, 5) == durations
