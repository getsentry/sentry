from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import DEFAULT_DB_ALIAS, connections, transaction
from django.db.utils import OperationalError
from django.test.utils import CaptureQueriesContext

from sentry.testutils.cases import TestCase
from sentry.utils.db import (
    StatementTimeoutBudgetExceeded,
    make_statement_timeout_budget,
)


class MakeStatementTimeoutBudgetTest(TestCase):
    def test_uses_remaining_budget_for_each_statement(self) -> None:
        connection = connections[DEFAULT_DB_ALIAS]

        with patch("sentry.utils.db.monotonic", side_effect=[100, 101, 104]):
            budgeted_statement = make_statement_timeout_budget(timedelta(seconds=10))
            with CaptureQueriesContext(connection) as queries:
                with budgeted_statement(), connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                with budgeted_statement(), connection.cursor() as cursor:
                    cursor.execute("SELECT 1")

        timeout_queries = [query["sql"] for query in queries if "statement_timeout" in query["sql"]]
        assert timeout_queries == [
            "SET LOCAL statement_timeout = 9000",
            "SET LOCAL statement_timeout = 6000",
        ]

    def test_deadline_starts_when_budget_is_created(self) -> None:
        connection = connections[DEFAULT_DB_ALIAS]

        with patch("sentry.utils.db.monotonic", side_effect=[100, 103]):
            budgeted_statement = make_statement_timeout_budget(timedelta(seconds=10))
            with CaptureQueriesContext(connection) as queries:
                with budgeted_statement(), connection.cursor() as cursor:
                    cursor.execute("SELECT 1")

        assert any("statement_timeout = 7000" in query["sql"] for query in queries)

    def test_raises_before_query_when_budget_is_exhausted(self) -> None:
        connection = connections[DEFAULT_DB_ALIAS]

        with patch("sentry.utils.db.monotonic", side_effect=[100, 110]):
            budgeted_statement = make_statement_timeout_budget(timedelta(seconds=10))
            with CaptureQueriesContext(connection) as queries:
                with pytest.raises(StatementTimeoutBudgetExceeded):
                    with budgeted_statement():
                        raise AssertionError("unreachable")

        assert list(queries) == []

    def test_raises_instead_of_disabling_sub_millisecond_timeout(self) -> None:
        with patch("sentry.utils.db.monotonic", side_effect=[100, 100.0005]):
            budgeted_statement = make_statement_timeout_budget(timedelta(milliseconds=1))

            with pytest.raises(StatementTimeoutBudgetExceeded):
                with budgeted_statement():
                    raise AssertionError("unreachable")

    def test_budget_exhaustion_is_an_operational_error(self) -> None:
        assert issubclass(StatementTimeoutBudgetExceeded, OperationalError)

    def test_refuses_to_run_inside_an_open_transaction(self) -> None:
        with patch("sentry.utils.db.monotonic", return_value=100):
            budgeted_statement = make_statement_timeout_budget(timedelta(seconds=10))

            with (
                transaction.atomic(using=DEFAULT_DB_ALIAS),
                pytest.raises(RuntimeError, match="cannot be used inside an open transaction"),
            ):
                with budgeted_statement():
                    raise AssertionError("unreachable")

    def test_server_side_timeout_leaves_connection_usable(self) -> None:
        connection = connections[DEFAULT_DB_ALIAS]
        budgeted_statement = make_statement_timeout_budget(timedelta(milliseconds=20))

        with pytest.raises(OperationalError):
            with budgeted_statement(), connection.cursor() as cursor:
                cursor.execute("SELECT pg_sleep(0.1)")

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            assert cursor.fetchone() == (1,)

    def test_propagates_unrelated_exceptions(self) -> None:
        with patch("sentry.utils.db.monotonic", return_value=100):
            budgeted_statement = make_statement_timeout_budget(timedelta(seconds=10))

            with pytest.raises(ValueError, match="query setup failed"):
                with budgeted_statement():
                    raise ValueError("query setup failed")
