import psycopg2
import pytest
from django.db.utils import DatabaseError, InterfaceError, OperationalError

from sentry.db.postgres.helpers import can_reconnect


class TestCanReconnect:
    """Tests for the can_reconnect helper function"""

    def test_psycopg2_interface_error(self):
        """psycopg2.InterfaceError should trigger reconnection"""
        exc = psycopg2.InterfaceError("connection closed")
        assert can_reconnect(exc) is True

    def test_django_interface_error(self):
        """Django's InterfaceError should trigger reconnection"""
        exc = InterfaceError("connection closed")
        assert can_reconnect(exc) is True

    def test_psycopg2_operational_error_server_closed(self):
        """psycopg2.OperationalError with 'server closed' message should trigger reconnection"""
        exc = psycopg2.OperationalError(
            "server closed the connection unexpectedly\n"
            "\tThis probably means the server terminated abnormally\n"
            "\tbefore or while processing the request.\n"
        )
        assert can_reconnect(exc) is True

    def test_django_operational_error_server_closed(self):
        """Django's OperationalError with 'server closed' message should trigger reconnection"""
        exc = OperationalError(
            "server closed the connection unexpectedly\n"
            "\tThis probably means the server terminated abnormally\n"
            "\tbefore or while processing the request.\n"
        )
        assert can_reconnect(exc) is True

    def test_operational_error_with_sql_note(self):
        """OperationalError with SQL note should still be recognized"""
        exc = OperationalError(
            "server closed the connection unexpectedly\n"
            "\tThis probably means the server terminated abnormally\n"
            "\tbefore or while processing the request.\n\n"
            'SQL: SELECT "sentry_project"."id" FROM "sentry_project" WHERE "sentry_project"."id" = %s LIMIT 21'
        )
        assert can_reconnect(exc) is True

    def test_operational_error_client_idle_timeout(self):
        """OperationalError with 'client_idle_timeout' should trigger reconnection"""
        exc = OperationalError("client_idle_timeout")
        assert can_reconnect(exc) is True

    def test_operational_error_connection_already_closed(self):
        """OperationalError with 'connection already closed' should trigger reconnection"""
        exc = psycopg2.OperationalError("connection already closed")
        assert can_reconnect(exc) is True

    def test_operational_error_terminating_connection(self):
        """OperationalError with 'terminating connection' should trigger reconnection"""
        exc = OperationalError("terminating connection due to administrator command")
        assert can_reconnect(exc) is True

    def test_operational_error_connection_to_server(self):
        """OperationalError with 'connection to server' should trigger reconnection"""
        exc = OperationalError("connection to server was lost")
        assert can_reconnect(exc) is True

    def test_operational_error_could_not_connect(self):
        """OperationalError with 'could not connect to server' should trigger reconnection"""
        exc = OperationalError("could not connect to server: Connection refused")
        assert can_reconnect(exc) is True

    def test_operational_error_connection_timed_out(self):
        """OperationalError with 'connection timed out' should trigger reconnection"""
        exc = OperationalError("connection timed out")
        assert can_reconnect(exc) is True

    def test_operational_error_ssl_connection_closed(self):
        """OperationalError with SSL connection closed should trigger reconnection"""
        exc = OperationalError("SSL connection has been closed unexpectedly")
        assert can_reconnect(exc) is True

    def test_operational_error_no_connection_to_server(self):
        """OperationalError with 'no connection to the server' should trigger reconnection"""
        exc = OperationalError("no connection to the server")
        assert can_reconnect(exc) is True

    def test_operational_error_default_isolation_level(self):
        """OperationalError with isolation level error should trigger reconnection"""
        exc = psycopg2.OperationalError("can't fetch default_isolation_level")
        assert can_reconnect(exc) is True

    def test_operational_error_datestyle(self):
        """OperationalError with datestyle error should trigger reconnection"""
        exc = psycopg2.OperationalError("can't set datestyle to ISO")
        assert can_reconnect(exc) is True

    def test_django_operational_error_with_psycopg2_cause(self):
        """Django OperationalError wrapping psycopg2 exception should be recognized via __cause__"""
        psycopg2_exc = psycopg2.OperationalError(
            "server closed the connection unexpectedly\n"
            "\tThis probably means the server terminated abnormally\n"
            "\tbefore or while processing the request.\n"
        )
        # Simulate how Django wraps exceptions
        django_exc = OperationalError("wrapped error")
        django_exc.__cause__ = psycopg2_exc
        
        assert can_reconnect(django_exc) is True

    def test_database_error_with_reconnectable_cause(self):
        """DatabaseError with reconnectable __cause__ should trigger reconnection"""
        psycopg2_exc = psycopg2.OperationalError("client_idle_timeout")
        db_exc = DatabaseError("database error")
        db_exc.__cause__ = psycopg2_exc
        
        assert can_reconnect(db_exc) is True

    def test_operational_error_unrelated_message(self):
        """OperationalError with unrelated message should NOT trigger reconnection"""
        exc = OperationalError("syntax error at or near")
        assert can_reconnect(exc) is False

    def test_database_error_unrelated_message(self):
        """DatabaseError with unrelated message should NOT trigger reconnection"""
        exc = DatabaseError("some other database error")
        assert can_reconnect(exc) is False

    def test_generic_exception(self):
        """Generic exceptions should NOT trigger reconnection"""
        exc = Exception("something went wrong")
        assert can_reconnect(exc) is False

    def test_value_error(self):
        """ValueError should NOT trigger reconnection"""
        exc = ValueError("invalid value")
        assert can_reconnect(exc) is False

    def test_empty_operational_error(self):
        """OperationalError with empty message should NOT trigger reconnection"""
        exc = OperationalError("")
        assert can_reconnect(exc) is False

    def test_database_error_server_closed(self):
        """Generic DatabaseError with 'server closed' message should trigger reconnection (backward compatibility)"""
        exc = DatabaseError("server closed the connection unexpectedly")
        assert can_reconnect(exc) is True

    def test_database_error_with_cause_server_closed(self):
        """DatabaseError with __cause__ containing 'server closed' should trigger reconnection"""
        cause_exc = Exception("server closed the connection unexpectedly")
        db_exc = DatabaseError("wrapped")
        db_exc.__cause__ = cause_exc
        
        assert can_reconnect(db_exc) is True
