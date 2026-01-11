"""
Tests for database utilities in sentry.utils.statement_timeout
"""

import pytest
from django.db.utils import OperationalError

from sentry.utils.statement_timeout import (
    execute_with_timeout_handling,
    handle_statement_timeout,
    with_statement_timeout_handling,
)


class MockQueryCanceled(Exception):
    """Mock for psycopg2.errors.QueryCanceled"""

    pass


class TestHandleStatementTimeout:
    def test_handles_statement_timeout(self):
        """Test that statement timeout is caught and handled"""

        def failing_query():
            exc = OperationalError("canceling statement due to user request")
            exc.__cause__ = MockQueryCanceled()
            raise exc

        # Should not raise
        with handle_statement_timeout():
            failing_query()

    def test_reraises_when_configured(self):
        """Test that statement timeout can be re-raised"""

        def failing_query():
            exc = OperationalError("canceling statement due to user request")
            exc.__cause__ = MockQueryCanceled()
            raise exc

        with pytest.raises(OperationalError, match="canceling statement"):
            with handle_statement_timeout(reraise=True):
                failing_query()

    def test_reraises_non_timeout_errors(self):
        """Test that non-timeout errors are re-raised"""

        def failing_query():
            raise OperationalError("some other database error")

        with pytest.raises(OperationalError, match="some other database error"):
            with handle_statement_timeout():
                failing_query()

    def test_successful_query_passes_through(self):
        """Test that successful queries work normally"""
        result = []

        with handle_statement_timeout():
            result.append("success")

        assert result == ["success"]


class TestWithStatementTimeoutHandlingDecorator:
    def test_returns_fallback_on_timeout(self):
        """Test that fallback value is returned on timeout"""

        @with_statement_timeout_handling(fallback_value=[])
        def failing_query():
            exc = OperationalError("canceling statement due to user request")
            exc.__cause__ = MockQueryCanceled()
            raise exc

        result = failing_query()
        assert result == []

    def test_returns_none_by_default(self):
        """Test that None is returned by default"""

        @with_statement_timeout_handling()
        def failing_query():
            exc = OperationalError("canceling statement due to user request")
            exc.__cause__ = MockQueryCanceled()
            raise exc

        result = failing_query()
        assert result is None

    def test_reraises_non_timeout_errors(self):
        """Test that non-timeout errors are re-raised"""

        @with_statement_timeout_handling(fallback_value=[])
        def failing_query():
            raise OperationalError("some other database error")

        with pytest.raises(OperationalError, match="some other database error"):
            failing_query()

    def test_successful_function_passes_through(self):
        """Test that successful functions work normally"""

        @with_statement_timeout_handling(fallback_value=[])
        def successful_query():
            return ["result1", "result2"]

        result = successful_query()
        assert result == ["result1", "result2"]


class TestExecuteWithTimeoutHandling:
    def test_returns_fallback_on_timeout(self):
        """Test that fallback value is returned on timeout"""

        def failing_query():
            exc = OperationalError("canceling statement due to user request")
            exc.__cause__ = MockQueryCanceled()
            raise exc

        result = execute_with_timeout_handling(failing_query, fallback_value=[])
        assert result == []

    def test_passes_arguments(self):
        """Test that arguments are passed correctly"""

        def add(a, b):
            return a + b

        result = execute_with_timeout_handling(add, 1, 2, fallback_value=0)
        assert result == 3

    def test_passes_keyword_arguments(self):
        """Test that keyword arguments are passed correctly"""

        def greet(name, greeting="Hello"):
            return f"{greeting}, {name}!"

        result = execute_with_timeout_handling(
            greet, name="World", greeting="Hi", fallback_value=""
        )
        assert result == "Hi, World!"

    def test_reraises_non_timeout_errors(self):
        """Test that non-timeout errors are re-raised"""

        def failing_query():
            raise OperationalError("some other database error")

        with pytest.raises(OperationalError, match="some other database error"):
            execute_with_timeout_handling(failing_query, fallback_value=[])
