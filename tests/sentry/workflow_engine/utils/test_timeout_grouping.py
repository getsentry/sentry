from typing import Any
from unittest.mock import Mock, patch

from sentry.taskworker.state import CurrentTaskState
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.workflow_engine.utils.timeout_grouping import timeout_grouping_context


class TestTimeoutGroupingContext:
    def test_with_task_state_and_processing_deadline_exceeded(self) -> None:
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.workflow_engine.utils.timeout_grouping.current_task",
            return_value=mock_task_state,
        ):
            with patch("sentry_sdk.new_scope") as mock_scope:
                mock_scope_instance = Mock()
                mock_scope.return_value.__enter__ = Mock(return_value=mock_scope_instance)
                mock_scope.return_value.__exit__ = Mock(return_value=None)

                # Capture the error processor function
                captured_processor = None

                def capture_processor(processor: Any) -> None:
                    nonlocal captured_processor
                    captured_processor = processor

                mock_scope_instance.add_error_processor = capture_processor

                with timeout_grouping_context("refinement1", "refinement2"):
                    pass

                # Test the processor function
                assert captured_processor is not None

                # Create a mock event and exception info
                event: Any = {}
                exc = ProcessingDeadlineExceeded("Test timeout")
                exc_info = (ProcessingDeadlineExceeded, exc, None)

                # Process the event
                result = captured_processor(event, exc_info)

                # Verify the fingerprint was set correctly
                assert result["fingerprint"] == [
                    "task.processing_deadline_exceeded",
                    "test_namespace",
                    "test_task",
                    "refinement1",
                    "refinement2",
                ]

    def test_with_task_state_and_non_processing_deadline_exceeded(self) -> None:
        mock_task_state = CurrentTaskState(
            id="test_id",
            namespace="test_namespace",
            taskname="test_task",
            attempt=1,
            processing_deadline_duration=30,
            retries_remaining=True,
        )

        with patch(
            "sentry.workflow_engine.utils.timeout_grouping.current_task",
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

                # Test the processor function with a different exception
                event = {"original": "data"}
                exc = ValueError("Some other error")
                exc_info = (ValueError, exc, None)

                result = captured_processor(event, exc_info)

                # Event should be unchanged
                assert result == {"original": "data"}
                assert "fingerprint" not in result

    def test_without_task_state(self) -> None:
        with patch("sentry.workflow_engine.utils.timeout_grouping.current_task", return_value=None):
            with patch("sentry.workflow_engine.utils.timeout_grouping.logger") as mock_logger:
                with timeout_grouping_context():
                    pass

                # Should log that no task state was found
                mock_logger.info.assert_called_once_with(
                    "No task state found in timeout_grouping_context"
                )

    def test_context_manager_yields_correctly(self) -> None:
        executed = False
        with patch("sentry.workflow_engine.utils.timeout_grouping.current_task", return_value=None):
            with timeout_grouping_context():
                executed = True

        assert executed is True
