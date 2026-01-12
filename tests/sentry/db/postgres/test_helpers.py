import psycopg2
import pytest
from django.db.utils import DatabaseError, InterfaceError, OperationalError

from sentry.db.postgres.helpers import can_reconnect


class TestCanReconnect:
    """Tests for can_reconnect helper function."""

    def test_interface_error_psycopg2(self):
        """psycopg2.InterfaceError should trigger reconnection."""
        exc = psycopg2.InterfaceError("connection already closed")
        assert can_reconnect(exc) is True

    def test_interface_error_django(self):
        """Django InterfaceError should trigger reconnection."""
        exc = InterfaceError("connection already closed")
        assert can_reconnect(exc) is True

    def test_operational_error_psycopg2_connection_closed(self):
        """psycopg2.OperationalError with 'connection already closed' should trigger reconnection."""
        exc = psycopg2.OperationalError("connection already closed")
        assert can_reconnect(exc) is True

    def test_operational_error_django_connection_closed(self):
        """Django OperationalError with 'connection already closed' should trigger reconnection."""
        exc = OperationalError("connection already closed")
        assert can_reconnect(exc) is True

    def test_operational_error_server_closed(self):
        """OperationalError with 'server closed the connection' should trigger reconnection."""
        exc = OperationalError("server closed the connection unexpectedly")
        assert can_reconnect(exc) is True

    def test_operational_error_client_timeout(self):
        """OperationalError with 'client_idle_timeout' should trigger reconnection."""
        exc = OperationalError("client_idle_timeout")
        assert can_reconnect(exc) is True

    def test_operational_error_terminating_connection(self):
        """OperationalError with 'terminating connection' should trigger reconnection."""
        exc = OperationalError("terminating connection due to administrator command")
        assert can_reconnect(exc) is True

    def test_operational_error_connection_lost(self):
        """OperationalError with 'connection to server' should trigger reconnection."""
        exc = OperationalError("connection to server was lost")
        assert can_reconnect(exc) is True

    def test_operational_error_could_not_connect(self):
        """OperationalError with 'could not connect to server' should trigger reconnection."""
        exc = OperationalError("could not connect to server: Connection refused")
        assert can_reconnect(exc) is True

    def test_operational_error_timeout(self):
        """OperationalError with 'connection timed out' should trigger reconnection."""
        exc = OperationalError("connection timed out")
        assert can_reconnect(exc) is True

    def test_operational_error_ssl_closed(self):
        """OperationalError with 'SSL connection has been closed' should trigger reconnection."""
        exc = OperationalError("SSL connection has been closed unexpectedly")
        assert can_reconnect(exc) is True

    def test_operational_error_no_connection(self):
        """OperationalError with 'no connection to the server' should trigger reconnection."""
        exc = OperationalError("no connection to the server")
        assert can_reconnect(exc) is True

    def test_operational_error_cant_fetch_isolation(self):
        """OperationalError with 'can't fetch default_isolation_level' should trigger reconnection."""
        exc = OperationalError("can't fetch default_isolation_level")
        assert can_reconnect(exc) is True

    def test_operational_error_cant_set_datestyle(self):
        """OperationalError with 'can't set datestyle' should trigger reconnection."""
        exc = OperationalError("can't set datestyle to ISO")
        assert can_reconnect(exc) is True

    def test_operational_error_unrelated_message(self):
        """OperationalError with unrelated message should NOT trigger reconnection."""
        exc = OperationalError("FATAL: too many connections for role")
        assert can_reconnect(exc) is False

    def test_operational_error_empty_message(self):
        """OperationalError with empty message should NOT trigger reconnection."""
        exc = OperationalError("")
        assert can_reconnect(exc) is False

    def test_database_error_server_closed(self):
        """DatabaseError with 'server closed the connection' should trigger reconnection."""
        exc = DatabaseError("server closed the connection unexpectedly")
        assert can_reconnect(exc) is True

    def test_database_error_client_timeout(self):
        """DatabaseError with 'client_idle_timeout' should trigger reconnection."""
        exc = DatabaseError("client_idle_timeout")
        assert can_reconnect(exc) is True

    def test_database_error_unrelated(self):
        """DatabaseError with unrelated message should NOT trigger reconnection."""
        exc = DatabaseError("duplicate key value violates unique constraint")
        assert can_reconnect(exc) is False

    def test_non_reconnectable_exception(self):
        """Non-database exceptions should NOT trigger reconnection."""
        exc = ValueError("some error")
        assert can_reconnect(exc) is False

    def test_operational_error_with_cause_connection_closed(self):
        """OperationalError with empty message but __cause__ with connection error should trigger reconnection."""
        cause = psycopg2.OperationalError("connection already closed")
        exc = OperationalError("")
        exc.__cause__ = cause
        assert can_reconnect(exc) is True

    def test_operational_error_with_cause_server_closed(self):
        """OperationalError with __cause__ containing server closed should trigger reconnection."""
        cause = psycopg2.OperationalError("server closed the connection unexpectedly")
        exc = OperationalError("SQL error")
        exc.__cause__ = cause
        assert can_reconnect(exc) is True

    def test_database_error_with_cause(self):
        """DatabaseError with __cause__ containing connection error should trigger reconnection."""
        cause = psycopg2.OperationalError("server closed the connection unexpectedly")
        exc = DatabaseError("")
        exc.__cause__ = cause
        assert can_reconnect(exc) is True
