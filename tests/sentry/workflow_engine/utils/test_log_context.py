import logging
from typing import Any
from unittest.mock import patch

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils import log_context


class LogContextTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.logger: log_context._Adapter = log_context.get_logger(__name__)  # type: ignore[assignment]

    def test_get_logger(self) -> None:
        logger: Any = log_context.get_logger("test")
        assert isinstance(logger, log_context._Adapter)

    def test_root_decorator(self) -> None:
        @log_context.root()
        def test_func() -> None:
            context = log_context._log_context_state.get()
            assert "context_id" in context.extra
            assert isinstance(context.extra["context_id"], str)

        test_func()

    def test_set_verbose(self) -> None:
        """Test that set_verbose promotes DEBUG logs to INFO."""

        @log_context.root(add_context_id=False)
        def test_func() -> None:
            with (
                log_context.new_context(verbose=True),
                patch.object(self.logger.logger, "log") as mock_log,
            ):
                self.logger.debug("test message")
                mock_log.assert_called_once_with(logging.INFO, "test message")

            with (
                log_context.new_context(verbose=False),
                patch.object(self.logger.logger, "log") as mock_log,
            ):
                self.logger.debug("test message")
                mock_log.assert_not_called()

        test_func()

    def test_add_extras(self) -> None:
        """Test that add_extras adds data to the log context."""

        @log_context.root()
        def test_func() -> None:
            log_context.add_extras(workflow_id=123, rule_id=456)
            context = log_context._log_context_state.get()
            assert context.extra["workflow_id"] == 123
            assert context.extra["rule_id"] == 456

            with log_context.new_context():
                context = log_context._log_context_state.get()
                assert context.extra["workflow_id"] == 123
                assert context.extra["rule_id"] == 456

        test_func()

    def test_logged_extras_override_context(self) -> None:
        """Test that extras passed to log calls override context extras."""

        @log_context.root(add_context_id=False)
        def test_func() -> None:
            log_context.add_extras(workflow_id=123, rule_id=456)
            with patch.object(self.logger.logger, "log") as mock_log:
                self.logger.info("test message", extra={"workflow_id": 789})
                mock_log.assert_called_once_with(
                    logging.INFO,
                    "test message",
                    extra={"workflow_id": 789, "rule_id": 456},
                )

        test_func()

    def test_new_context(self) -> None:
        """Test that new_context creates a sub-context with inherited and new data."""

        @log_context.root()
        def test_func() -> None:
            log_context.add_extras(workflow_id=123)
            with log_context.new_context(rule_id=456):
                context = log_context._log_context_state.get()
                assert context.extra["workflow_id"] == 123
                assert context.extra["rule_id"] == 456

        test_func()

    def test_new_context_verbose_inheritance(self) -> None:
        """Test that new_context inherits verbose setting unless specified."""

        @log_context.root()
        def test_func() -> None:
            log_context.set_verbose(True)
            with log_context.new_context():
                context = log_context._log_context_state.get()
                assert context.verbose is True

            with log_context.new_context(verbose=False):
                context = log_context._log_context_state.get()
                assert context.verbose is False

        test_func()

    def test_context_isolation(self) -> None:
        """Test that contexts are isolated between different root contexts."""
        context_ids = set()

        @log_context.root()
        def first_context() -> None:
            context = log_context._log_context_state.get()
            context_ids.add(context.extra["context_id"])

        @log_context.root()
        def second_context() -> None:
            context = log_context._log_context_state.get()
            context_ids.add(context.extra["context_id"])

        first_context()
        second_context()
        assert len(context_ids) == 2
