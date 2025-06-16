import logging
import uuid
from unittest.mock import MagicMock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils import log_context


class LogContextTest(TestCase):
    def setUp(self):
        super().setUp()
        self.logger = log_context.get_logger(__name__)

    def test_get_logger(self):
        """Test that get_logger returns a logger with the context filter."""
        logger = log_context.get_logger("test")
        assert isinstance(logger, logging.Logger)
        assert any(isinstance(f, log_context._ContextFilter) for f in logger.filters)

    def test_root_decorator(self):
        """Test that the root decorator creates a new context with a unique ID."""

        @log_context.root()
        def test_func():
            context = log_context._log_context_state.get()
            assert "context_id" in context.extra
            assert isinstance(context.extra["context_id"], str)
            # Verify the context ID is a valid UUID
            uuid.UUID(context.extra["context_id"])

        test_func()

    def test_set_verbose(self):
        """Test that set_verbose promotes DEBUG logs to INFO."""

        @log_context.root()
        def test_func():
            log_context.set_verbose(True)
            record = MagicMock()
            record.levelno = logging.DEBUG
            record.levelname = "DEBUG"
            context = log_context._log_context_state.get()
            context.modify_record(record)
            assert record.levelno == logging.INFO
            assert record.levelname == "INFO"

        test_func()

    def test_add_extras(self):
        """Test that add_extras adds data to the log context."""

        @log_context.root()
        def test_func():
            log_context.add_extras(workflow_id=123, rule_id=456)
            context = log_context._log_context_state.get()
            assert context.extra["workflow_id"] == 123
            assert context.extra["rule_id"] == 456

        test_func()

    def test_new_context(self):
        """Test that new_context creates a sub-context with inherited and new data."""

        @log_context.root()
        def test_func():
            log_context.add_extras(workflow_id=123)
            with log_context.new_context(rule_id=456):
                context = log_context._log_context_state.get()
                assert context.extra["workflow_id"] == 123
                assert context.extra["rule_id"] == 456

        test_func()

    def test_new_context_verbose_inheritance(self):
        """Test that new_context inherits verbose setting unless specified."""

        @log_context.root()
        def test_func():
            log_context.set_verbose(True)
            with log_context.new_context():
                context = log_context._log_context_state.get()
                assert context.verbose is True

            with log_context.new_context(verbose=False):
                context = log_context._log_context_state.get()
                assert context.verbose is False

        test_func()

    def test_context_isolation(self):
        """Test that contexts are isolated between different root contexts."""
        context_ids = set()

        @log_context.root()
        def first_context():
            context = log_context._log_context_state.get()
            context_ids.add(context.extra["context_id"])

        @log_context.root()
        def second_context():
            context = log_context._log_context_state.get()
            context_ids.add(context.extra["context_id"])

        first_context()
        second_context()
        assert len(context_ids) == 2

    def test_log_record_annotation(self):
        """Test that log records are annotated with context data."""

        @log_context.root()
        def test_func():
            log_context.add_extras(workflow_id=123)
            record = logging.LogRecord(
                "test", logging.INFO, "test.py", 1, "test message", (), None, None
            )
            context = log_context._log_context_state.get()
            context.modify_record(record)
            assert record.workflow_id == 123

        test_func()
