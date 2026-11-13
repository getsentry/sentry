from unittest import mock

import pytest
from django.db import connection, transaction
from django.db.utils import DataError

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.testutils.cases import TestCase, TransactionTestCase
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


class SavepointMetricsTest(TransactionTestCase):
    @mock.patch("sentry.db.postgres.base.metrics")
    def test_counts_savepoints_per_transaction(self, metrics: mock.MagicMock) -> None:
        tags = {"taskname": "none", "alias": "default"}

        with transaction.atomic(using="default"):
            for _ in range(70):
                with transaction.atomic(using="default"):
                    pass

        with pytest.raises(ValueError):
            with transaction.atomic(using="default"):
                for _ in range(12):
                    with transaction.atomic(using="default"):
                        pass
                raise ValueError

        assert metrics.incr.call_args_list == [
            mock.call("db.transaction.savepoint_overflow", tags=tags),
        ]
        assert metrics.distribution.call_args_list == [
            mock.call("db.transaction.savepoints", 70, tags=tags),
            mock.call("db.transaction.savepoints", 12, tags=tags),
        ]


@django_db_all
def test_sql_note() -> None:
    with pytest.raises(DataError) as excinfo:
        connection.cursor().execute("select 1/0")
    assert excinfo.value.__notes__ == ["SQL: select 1/0"]
