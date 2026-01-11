"""
Tests for sentry.db.postgres.helpers
"""

import psycopg2.errors
import pytest
from django.db.utils import InterfaceError, OperationalError

from sentry.db.postgres.helpers import can_reconnect, is_statement_timeout


class TestCanReconnect:
    def test_interface_error_can_reconnect(self):
        assert can_reconnect(psycopg2.InterfaceError()) is True
        assert can_reconnect(InterfaceError()) is True

    def test_server_closed_connection_can_reconnect(self):
        exc = OperationalError("server closed the connection unexpectedly")
        assert can_reconnect(exc) is True

    def test_client_idle_timeout_can_reconnect(self):
        exc = OperationalError("client_idle_timeout")
        assert can_reconnect(exc) is True

    def test_other_errors_cannot_reconnect(self):
        exc = OperationalError("some other error")
        assert can_reconnect(exc) is False

    def test_non_database_error_cannot_reconnect(self):
        exc = ValueError("not a database error")
        assert can_reconnect(exc) is False


class TestIsStatementTimeout:
    def test_explicit_statement_timeout_message(self):
        """Test detection of explicit statement timeout message"""
        exc = OperationalError("canceling statement due to statement timeout")
        assert is_statement_timeout(exc) is True

    def test_query_canceled_with_user_request(self):
        """Test detection of QueryCanceled with user request message"""
        exc = OperationalError("canceling statement due to user request")
        exc.__cause__ = psycopg2.errors.QueryCanceled("canceling statement due to user request")
        assert is_statement_timeout(exc) is True

    def test_query_canceled_without_user_request(self):
        """Test that QueryCanceled without user request is not detected"""
        exc = OperationalError("some other error")
        exc.__cause__ = psycopg2.errors.QueryCanceled("some other error")
        assert is_statement_timeout(exc) is False

    def test_non_query_canceled_with_user_request(self):
        """Test that non-QueryCanceled errors with user request are not detected"""
        exc = OperationalError("canceling statement due to user request")
        # No __cause__ attribute
        assert is_statement_timeout(exc) is False

    def test_other_operational_errors(self):
        """Test that other operational errors are not detected as timeouts"""
        exc = OperationalError("connection refused")
        assert is_statement_timeout(exc) is False

    def test_non_operational_errors(self):
        """Test that non-OperationalError exceptions return False"""
        assert is_statement_timeout(ValueError("not a database error")) is False
        assert is_statement_timeout(psycopg2.InterfaceError()) is False

    def test_psycopg2_operational_error_directly(self):
        """Test detection with psycopg2.OperationalError directly"""
        exc = psycopg2.OperationalError("canceling statement due to statement timeout")
        assert is_statement_timeout(exc) is True
