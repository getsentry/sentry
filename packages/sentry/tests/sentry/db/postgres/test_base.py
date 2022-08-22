from django.utils.encoding import force_bytes, force_text

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.testutils import TestCase


class CursorWrapperTestCase(TestCase):
    def test_null_bytes(self):
        from django.db import connection

        cursor = connection.cursor()
        cursor.execute("SELECT %s", [b"Ma\x00tt"])
        assert force_bytes(cursor.fetchone()[0]) == b"Matt"

        cursor.execute("SELECT %s", ["Ma\x00tt"])
        assert cursor.fetchone()[0] == "Matt"

        cursor = connection.cursor()
        cursor.execute("SELECT %(name)s", {"name": b"Ma\x00tt"})
        assert force_bytes(cursor.fetchone()[0]) == b"Matt"

        cursor.execute("SELECT %(name)s", {"name": "Ma\x00tt"})
        assert cursor.fetchone()[0] == "Matt"

    def test_null_bytes_at_max_len_bytes(self):
        from django.db import connection

        cursor = connection.cursor()

        long_str = (b"a" * (MAX_CULPRIT_LENGTH - 1)) + b"\x00"
        assert len(long_str) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %s", [long_str])
        long_str_from_db = force_bytes(cursor.fetchone()[0])
        assert long_str_from_db == (b"a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %(long_str)s", {"long_str": long_str})
        long_str_from_db = force_bytes(cursor.fetchone()[0])
        assert long_str_from_db == (b"a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

    def test_null_bytes_at_max_len_unicode(self):
        from django.db import connection

        cursor = connection.cursor()

        long_str = ("a" * (MAX_CULPRIT_LENGTH - 1)) + "\x00"
        assert len(long_str) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %s", [long_str])
        long_str_from_db = cursor.fetchone()[0]
        assert long_str_from_db == ("a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %(long_str)s", {"long_str": long_str})
        long_str_from_db = cursor.fetchone()[0]
        assert long_str_from_db == ("a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

    def test_lone_surrogates(self):
        from django.db import connection

        cursor = connection.cursor()

        bad_str = "Hello\ud83dWorld🇦🇹!"
        cursor.execute("SELECT %s", [bad_str])
        bad_str_from_db = force_text(cursor.fetchone()[0])
        assert bad_str_from_db == "HelloWorld🇦🇹!"

        cursor.execute("SELECT %(bad_str)s", {"bad_str": bad_str})
        bad_str_from_db = force_text(cursor.fetchone()[0])
        assert bad_str_from_db == "HelloWorld🇦🇹!"
