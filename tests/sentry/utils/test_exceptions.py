from collections.abc import Callable
from typing import Any
from unittest.mock import Mock, patch

from rediscluster.exceptions import RedisClusterException  # type: ignore[attr-defined]

from sentry.taskworker.state import CurrentTaskState
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.utils.exceptions import (
    exception_grouping_context,
    quiet_redis_noise,
    set_sentry_exception_levels,
    timeout_grouping_context,
)


class CustomError(Exception):
    """Custom exception for testing."""

    pass


class AnotherError(Exception):
    """Another custom exception for testing."""

    pass


class TestExceptionGroupingContext:
    def test_with_task_state_and_single_exception_mapping(self) -> None:
        """Test exception_grouping_context with a single exception type mapping."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                exception_mapping: dict[type[BaseException], str] = {
                    CustomError: "custom.error.fingerprint"
                }
                with exception_grouping_context(exception_mapping, "refinement1", "refinement2"):
                    pass

                assert captured_processor is not None

                # Test with matching exception
                event: Any = {}
                exc = CustomError("Test error")
                exc_info = (CustomError, exc, None)

                result = captured_processor(event, exc_info)

                assert result["fingerprint"] == [
                    "custom.error.fingerprint",
                    "test_namespace",
                    "test_task",
                    "refinement1",
                    "refinement2",
                ]

    def test_with_task_state_and_multiple_exception_mappings(self) -> None:
        """Test exception_grouping_context with multiple exception type mappings."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                exception_mapping = {
                    CustomError: "custom.error.fingerprint",
                    AnotherError: "another.error.fingerprint",
                    ProcessingDeadlineExceeded: "deadline.exceeded",
                }
                with exception_grouping_context(exception_mapping):
                    pass

                assert captured_processor is not None

                # Test first exception type
                event1: Any = {}
                exc1 = CustomError("Test error")
                exc_info1 = (CustomError, exc1, None)
                result1 = captured_processor(event1, exc_info1)
                assert result1["fingerprint"] == [
                    "custom.error.fingerprint",
                    "test_namespace",
                    "test_task",
                ]

                # Test second exception type
                event2: Any = {}
                exc2 = AnotherError("Another error")
                exc_info2 = (AnotherError, exc2, None)
                result2 = captured_processor(event2, exc_info2)
                assert result2["fingerprint"] == [
                    "another.error.fingerprint",
                    "test_namespace",
                    "test_task",
                ]

                # Test third exception type
                event3: Any = {}
                exc3 = ProcessingDeadlineExceeded("Deadline exceeded")
                exc_info3 = (ProcessingDeadlineExceeded, exc3, None)
                result3 = captured_processor(event3, exc_info3)
                assert result3["fingerprint"] == [
                    "deadline.exceeded",
                    "test_namespace",
                    "test_task",
                ]

    def test_with_task_state_and_non_mapped_exception(self) -> None:
        """Test that non-mapped exceptions don't get fingerprints modified."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                exception_mapping: dict[type[BaseException], str] = {
                    CustomError: "custom.error.fingerprint"
                }
                with exception_grouping_context(exception_mapping):
                    pass

                assert captured_processor is not None

                # Test with unmapped exception
                event = {"original": "data"}
                exc = ValueError("Unmapped error")
                exc_info = (ValueError, exc, None)

                result = captured_processor(event, exc_info)

                # Event should be unchanged
                assert result == {"original": "data"}
                assert "fingerprint" not in result

    def test_without_task_state(self) -> None:
        """Test that the context works when no task state is available."""
        with patch("sentry.utils.exceptions.current_task", return_value=None):
            with patch("sentry.utils.exceptions.logger") as mock_logger:
                exception_mapping: dict[type[BaseException], str] = {
                    CustomError: "custom.error.fingerprint"
                }
                with exception_grouping_context(exception_mapping):
                    pass

                mock_logger.info.assert_called_once_with(
                    "No task state found in exception_grouping_context"
                )

    def test_context_manager_yields_correctly(self) -> None:
        """Test that the context manager yields correctly."""
        executed = False
        with patch("sentry.utils.exceptions.current_task", return_value=None):
            exception_mapping: dict[type[BaseException], str] = {
                CustomError: "custom.error.fingerprint"
            }
            with exception_grouping_context(exception_mapping):
                executed = True

        assert executed is True

    def test_exception_inheritance(self) -> None:
        """Test that exception inheritance works correctly."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        class BaseError(Exception):
            pass

        class DerivedError(BaseError):
            pass

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                # Map the base error
                exception_mapping: dict[type[BaseException], str] = {
                    BaseError: "base.error.fingerprint"
                }
                with exception_grouping_context(exception_mapping):
                    pass

                assert captured_processor is not None

                # Test with derived exception (should match base error mapping)
                event: Any = {}
                exc = DerivedError("Derived error")
                exc_info = (DerivedError, exc, None)

                result = captured_processor(event, exc_info)

                assert result["fingerprint"] == [
                    "base.error.fingerprint",
                    "test_namespace",
                    "test_task",
                ]

    def test_empty_exception_mapping(self) -> None:
        """Test that empty exception mapping works correctly."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                # Empty mapping
                exception_mapping: dict[type[BaseException], str] = {}
                with exception_grouping_context(exception_mapping):
                    pass

                assert captured_processor is not None

                # Test with any exception
                event = {"original": "data"}
                exc = ValueError("Some error")
                exc_info = (ValueError, exc, None)

                result = captured_processor(event, exc_info)

                # Event should be unchanged
                assert result == {"original": "data"}
                assert "fingerprint" not in result


class TestTimeoutGroupingContext:
    """Test that timeout_grouping_context still works as expected."""

    def test_timeout_grouping_context_works_as_before(self) -> None:
        """Test that timeout_grouping_context maintains its original behavior."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                with timeout_grouping_context("refinement1", "refinement2"):
                    pass

                assert captured_processor is not None

                # Test with ProcessingDeadlineExceeded
                event: Any = {}
                exc = ProcessingDeadlineExceeded("Test timeout")
                exc_info = (ProcessingDeadlineExceeded, exc, None)

                result = captured_processor(event, exc_info)

                assert result["fingerprint"] == [
                    "task.processing_deadline_exceeded",
                    "test_namespace",
                    "test_task",
                    "refinement1",
                    "refinement2",
                ]

    def test_timeout_grouping_context_ignores_other_exceptions(self) -> None:
        """Test that timeout_grouping_context ignores non-ProcessingDeadlineExceeded exceptions."""
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.utils.exceptions.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                with timeout_grouping_context():
                    pass

                assert captured_processor is not None

                # Test with different exception
                event = {"original": "data"}
                exc = ValueError("Some other error")
                exc_info = (ValueError, exc, None)

                result = captured_processor(event, exc_info)

                # Event should be unchanged
                assert result == {"original": "data"}
                assert "fingerprint" not in result


class TestSetSentryExceptionLevels:
    def test_basic_functionality_minimal_mocking(self) -> None:
        with patch("sentry_sdk.new_scope") as mock_scope:
            mock_scope_instance = Mock()
            mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
            mock_scope.return_value.__exit__ = Mock(return_value=None)

            # Use a single-element list to capture the processor
            captured_processors: list[Callable[[Any, Any], Any]] = []
            mock_scope_instance.add_error_processor = captured_processors.append

            # Use the context manager with exception type as key
            with set_sentry_exception_levels({ValueError: "warning"}):
                pass

            # Basic validation that processor was captured
            assert len(captured_processors) == 1
            processor = captured_processors[0]

            # Test that it correctly processes a ValueError
            event = {"level": "error", "other_data": "preserved"}
            exc = ValueError("test error")
            exc_info = (ValueError, exc, None)

            result = processor(event, exc_info)

            # Verify the level was changed and other data preserved
            assert result["level"] == "warning"
            assert result["other_data"] == "preserved"


class TestQuietRedisNoise:
    def test_redis_cluster_exception_captured_and_reraised(self) -> None:
        with patch("sentry_sdk.capture_exception") as mock_capture:
            try:
                with quiet_redis_noise():
                    raise RedisClusterException("Cannot connect to Redis")
            except RedisClusterException:
                mock_capture.assert_called_once()
            else:
                assert False, "RedisClusterException was not re-raised"

    def test_other_exceptions_not_captured(self) -> None:
        with patch("sentry_sdk.capture_exception") as mock_capture:
            try:
                with quiet_redis_noise():
                    raise ValueError("Some other error")
            except ValueError:
                mock_capture.assert_not_called()
            else:
                assert False, "ValueError was not re-raised"
