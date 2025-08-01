import contextlib
from typing import Any, NoReturn
from unittest import mock

import psycopg2
import pytest
from django.db import connection, connections
from django.db.backends.postgresql.base import DatabaseWrapper
from django.db.utils import DataError
from django.test import override_settings

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


class CursorWrapperTestCase(TestCase):
    def test_null_byte(self) -> None:
        cursor = connection.cursor()
        cursor.execute("SELECT %s", [b"Ma\x00tt"])
        assert bytes(cursor.fetchone()[0]) == b"Ma\x00tt"

        cursor = connection.cursor()
        cursor.execute("SELECT %(name)s", {"name": b"Ma\x00tt"})
        assert bytes(cursor.fetchone()[0]) == b"Ma\x00tt"

    def test_null_character(self) -> None:
        cursor = connection.cursor()

        cursor.execute("SELECT %s", ["Ma\x00tt"])
        assert cursor.fetchone()[0] == "Matt"

        cursor.execute("SELECT %(name)s", {"name": "Ma\x00tt"})
        assert cursor.fetchone()[0] == "Matt"

    def test_null_byte_at_max_len_bytes(self) -> None:
        cursor = connection.cursor()

        long_bytes = (b"a" * (MAX_CULPRIT_LENGTH - 1)) + b"\x00"

        cursor.execute("SELECT %s", [long_bytes])
        long_bytes_from_db = bytes(cursor.fetchone()[0])
        assert long_bytes_from_db == long_bytes

        cursor.execute("SELECT %(long_bytes)s", {"long_bytes": long_bytes})
        long_bytes_from_db = bytes(cursor.fetchone()[0])
        assert long_bytes_from_db == long_bytes

    def test_null_character_at_max_len_str(self) -> None:
        cursor = connection.cursor()

        long_str = ("a" * (MAX_CULPRIT_LENGTH - 1)) + "\x00"

        cursor.execute("SELECT %s", [long_str])
        long_str_from_db = cursor.fetchone()[0]
        assert long_str_from_db == ("a" * (MAX_CULPRIT_LENGTH - 1))

        cursor.execute("SELECT %(long_str)s", {"long_str": long_str})
        long_str_from_db = cursor.fetchone()[0]
        assert long_str_from_db == ("a" * (MAX_CULPRIT_LENGTH - 1))

    def test_lone_surrogates(self) -> None:
        cursor = connection.cursor()

        bad_str = "Hello\ud83dWorld🇦🇹!"
        cursor.execute("SELECT %s", [bad_str])
        bad_str_from_db = cursor.fetchone()[0]
        assert bad_str_from_db == "HelloWorld🇦🇹!"

        cursor.execute("SELECT %(bad_str)s", {"bad_str": bad_str})
        bad_str_from_db = cursor.fetchone()[0]
        assert bad_str_from_db == "HelloWorld🇦🇹!"


@django_db_all
def test_sql_note() -> None:
    with pytest.raises(DataError) as excinfo:
        connection.cursor().execute("select 1/0")
    assert excinfo.value.__notes__ == ["SQL: select 1/0"]


@django_db_all
@override_settings(DEBUG=False)  # force non-debug cursors
def test_database_wrapper_cursor_create_retry() -> None:
    done = False
    orig_create = DatabaseWrapper.create_cursor

    def newcreate(self: DatabaseWrapper, name: str | None = None) -> Any:
        nonlocal done
        if done:
            return orig_create(self, name)
        else:
            done = True
            raise psycopg2.OperationalError(
                "server closed the connection unexpectedly\n\tThis probably means the server terminated abnormally\n\tbefore or while processing the request.\n"
            )

    # the mocking here is difficult because psycopg2 cursor / connections are immutable / unpatchable
    with (
        mock.patch.object(DatabaseWrapper, "create_cursor", newcreate),
        contextlib.closing(connections.create_connection("default")) as conn,
        conn.cursor() as cursor,
    ):
        # we did a retry
        assert done is True
        # and the cursor still works
        cursor.execute("select 1")
        assert cursor.fetchone() == (1,)


@django_db_all
@override_settings(DEBUG=False)  # force non-debug cursors
def test_cursor_wrapper_execute_retry() -> None:
    done = False

    class Disconnects:
        def __init__(self, cursor: object) -> None:
            self._cursor = cursor

        def __getattr__(self, a: str) -> Any:
            return getattr(self._cursor, a)

        def execute(self, *a: Any, **k: Any) -> NoReturn:
            nonlocal done
            done = True
            raise psycopg2.OperationalError(
                "server closed the connection unexpectedly\n\tThis probably means the server terminated abnormally\n\tbefore or while processing the request.\n"
            )

    # the mocking here is difficult because psycopg2 cursor / connections are immutable / unpatchable
    with (
        contextlib.closing(connections.create_connection("default")) as conn,
        conn.cursor() as cursor,
        mock.patch.object(cursor, "cursor", Disconnects(cursor.cursor)),
    ):
        # the cursor works
        cursor.execute("select 1")
        assert cursor.fetchone() == (1,)
        # and we did a retry
        assert done is True
        # and we didn't double-wrap the cursor
        assert type(cursor.cursor).__module__.startswith("psycopg2")
