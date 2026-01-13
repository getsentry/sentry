from unittest import mock

import psycopg2
import pytest
from django.db.utils import OperationalError

from sentry.db.postgres.base import CursorWrapper, DatabaseWrapper
from sentry.testutils.cases import TestCase


class TestCursorWrapperReconnection(TestCase):
    """Tests for CursorWrapper auto-reconnection behavior"""

    def test_execute_reconnects_on_server_closed_error(self):
        """When server closes connection, execute should reconnect and retry"""
        # Create a mock database wrapper
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = False
        
        # Create a mock cursor that will fail once, then succeed
        mock_cursor = mock.Mock()
        call_count = 0
        
        def execute_side_effect(sql, params=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call raises OperationalError
                raise OperationalError(
                    "server closed the connection unexpectedly\n"
                    "\tThis probably means the server terminated abnormally\n"
                    "\tbefore or while processing the request.\n"
                )
            # Second call succeeds
            return None
        
        mock_cursor.execute.side_effect = execute_side_effect
        
        # Setup _cursor to return a new cursor on reconnection
        new_cursor = mock.Mock()
        new_cursor.execute.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        # Create CursorWrapper and test execute
        wrapper = CursorWrapper(mock_db, mock_cursor)
        
        # Execute should succeed after reconnection
        wrapper.execute("SELECT 1")
        
        # Verify that close was called with reconnect=True
        mock_db.close.assert_called_once_with(reconnect=True)
        
        # Verify that _cursor was called to get a new cursor
        mock_db._cursor.assert_called_once()
        
        # Verify that errors_occurred was reset
        assert mock_db.errors_occurred is False
        
        # Verify that the new cursor was used
        new_cursor.execute.assert_called_once_with("SELECT 1")

    def test_execute_reconnects_on_client_idle_timeout(self):
        """When client idle timeout occurs, execute should reconnect and retry"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = False
        
        mock_cursor = mock.Mock()
        mock_cursor.execute.side_effect = OperationalError("client_idle_timeout")
        
        new_cursor = mock.Mock()
        new_cursor.execute.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        wrapper.execute("SELECT 1")
        
        mock_db.close.assert_called_once_with(reconnect=True)
        mock_db._cursor.assert_called_once()
        assert mock_db.errors_occurred is False
        new_cursor.execute.assert_called_once()

    def test_execute_does_not_reconnect_on_syntax_error(self):
        """When a non-reconnectable error occurs, should not attempt reconnection"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_cursor = mock.Mock()
        mock_cursor.execute.side_effect = OperationalError("syntax error at or near")
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        
        with pytest.raises(OperationalError):
            wrapper.execute("SELECT invalid syntax")
        
        # Should not attempt to reconnect
        mock_db.close.assert_not_called()
        mock_db._cursor.assert_not_called()

    def test_execute_reconnects_with_params(self):
        """Reconnection should work with parameterized queries"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = False
        
        mock_cursor = mock.Mock()
        mock_cursor.execute.side_effect = [
            OperationalError("server closed the connection unexpectedly"),
            None,
        ]
        
        new_cursor = mock.Mock()
        new_cursor.execute.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        wrapper.execute("SELECT * FROM table WHERE id = %s", [123])
        
        mock_db.close.assert_called_once_with(reconnect=True)
        new_cursor.execute.assert_called_once_with(
            "SELECT * FROM table WHERE id = %s", [123]
        )

    def test_executemany_reconnects_on_server_closed_error(self):
        """executemany should also reconnect on connection errors"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = False
        
        mock_cursor = mock.Mock()
        mock_cursor.executemany.side_effect = OperationalError(
            "server closed the connection unexpectedly"
        )
        
        new_cursor = mock.Mock()
        new_cursor.executemany.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        params = [(1,), (2,), (3,)]
        wrapper.executemany("INSERT INTO table VALUES (%s)", params)
        
        mock_db.close.assert_called_once_with(reconnect=True)
        mock_db._cursor.assert_called_once()
        assert mock_db.errors_occurred is False
        new_cursor.executemany.assert_called_once()

    def test_execute_handles_django_wrapped_exception(self):
        """Should handle Django-wrapped psycopg2 exceptions"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = False
        
        # Create a Django OperationalError with psycopg2 exception as __cause__
        psycopg2_exc = psycopg2.OperationalError(
            "server closed the connection unexpectedly"
        )
        django_exc = OperationalError("wrapped error")
        django_exc.__cause__ = psycopg2_exc
        
        mock_cursor = mock.Mock()
        mock_cursor.execute.side_effect = django_exc
        
        new_cursor = mock.Mock()
        new_cursor.execute.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        wrapper.execute("SELECT 1")
        
        # Should reconnect based on __cause__
        mock_db.close.assert_called_once_with(reconnect=True)
        mock_db._cursor.assert_called_once()
        new_cursor.execute.assert_called_once()

    def test_execute_resets_errors_occurred_flag(self):
        """Ensure errors_occurred flag is reset after successful reconnection"""
        mock_db = mock.Mock(spec=DatabaseWrapper)
        mock_db.errors_occurred = True  # Simulate Django marking connection as errored
        
        mock_cursor = mock.Mock()
        mock_cursor.execute.side_effect = OperationalError(
            "server closed the connection unexpectedly"
        )
        
        new_cursor = mock.Mock()
        new_cursor.execute.return_value = None
        mock_db._cursor.return_value = new_cursor
        
        wrapper = CursorWrapper(mock_db, mock_cursor)
        wrapper.execute("SELECT 1")
        
        # errors_occurred should be reset to False
        assert mock_db.errors_occurred is False


class TestDatabaseWrapperReconnection(TestCase):
    """Tests for DatabaseWrapper auto-reconnection behavior"""

    def test_cursor_reconnects_on_server_closed_error(self):
        """When getting a cursor fails with server closed error, should reconnect"""
        mock_connection = mock.Mock(spec=DatabaseWrapper)
        mock_connection.errors_occurred = False
        
        # First _cursor call fails, second succeeds
        call_count = 0
        
        def cursor_side_effect():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise OperationalError("server closed the connection unexpectedly")
            return mock.Mock()
        
        # We need to test the actual decorated method
        # Create a minimal mock that has the close method
        with mock.patch.object(DatabaseWrapper, 'close'):
            wrapper = DatabaseWrapper.__new__(DatabaseWrapper)
            wrapper.errors_occurred = False
            
            # Mock the parent class's _cursor method
            with mock.patch('django.db.backends.postgresql.base.DatabaseWrapper._cursor',
                          side_effect=cursor_side_effect):
                wrapper.close = mock.Mock()
                
                # Call _cursor which is decorated with auto_reconnect_connection
                from sentry.db.postgres.base import DatabaseWrapper as SentryDBWrapper
                result = SentryDBWrapper._cursor(wrapper)
                
                # Should have called close with reconnect=True
                wrapper.close.assert_called_once_with(reconnect=True)
                # Should have reset errors_occurred
                assert wrapper.errors_occurred is False
