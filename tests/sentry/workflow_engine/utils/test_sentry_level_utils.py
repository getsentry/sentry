from collections.abc import Callable
from typing import Any
from unittest.mock import Mock, patch

from sentry.workflow_engine.utils.sentry_level_utils import set_sentry_exception_levels


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
