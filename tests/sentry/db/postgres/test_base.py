import pytest
from django.db import connection
from django.db.utils import DataError

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

    def test_array_params(self) -> None:
        cursor = connection.cursor()
        names = ["Ma\x00tt", "Hello\ud83dWorld🇦🇹!", None]
        ids = [1, 2, 3]

        # Django's bulk inserts bind one array per column through UNNEST.
        cursor.execute("SELECT * FROM UNNEST(%s::text[], %s::integer[])", [names, ids])
        assert cursor.fetchall() == [("Matt", 1), ("HelloWorld🇦🇹!", 2), (None, 3)]

        cursor.execute(
            "SELECT * FROM UNNEST(%(names)s::text[], %(ids)s::integer[])",
            {"names": names, "ids": ids},
        )
        assert cursor.fetchall() == [("Matt", 1), ("HelloWorld🇦🇹!", 2), (None, 3)]

    def test_nested_array_params(self) -> None:
        cursor = connection.cursor()
        cursor.execute("SELECT %s::text[]", [[["Ma\x00tt", "Hello\ud83dWorld🇦🇹!"], ["", None]]])
        assert cursor.fetchone()[0] == [["Matt", "HelloWorld🇦🇹!"], ["", None]]

    def test_tuple_params(self) -> None:
        cursor = connection.cursor()

        # Tuples must keep IN-list syntax instead of becoming PostgreSQL arrays.
        cursor.execute("SELECT 'Matt' IN %s", [("Ma\x00tt", "Hello\ud83dWorld🇦🇹!")])
        assert cursor.fetchone()[0] is True

        cursor.execute(
            "SELECT 'HelloWorld🇦🇹!' IN %(names)s",
            {"names": ("Ma\x00tt", "Hello\ud83dWorld🇦🇹!")},
        )
        assert cursor.fetchone()[0] is True

    def test_null_byte_array_params(self) -> None:
        cursor = connection.cursor()
        cursor.execute("SELECT %s::bytea[]", [[b"Ma\x00tt", b"\x00"]])
        result = cursor.fetchone()[0]
        assert bytes(result[0]) == b"Ma\x00tt"
        assert bytes(result[1]) == b"\x00"

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
