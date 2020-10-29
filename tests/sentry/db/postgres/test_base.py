# coding: utf-8
from __future__ import absolute_import

import pytest
from sentry.testutils import TestCase
from sentry.constants import MAX_CULPRIT_LENGTH
from django.utils.encoding import force_text, force_bytes
from sentry.utils.compat import map


def psycopg2_version():
    import psycopg2

    version = psycopg2.__version__.split()[0].split(".")
    return tuple(map(int, version))


@pytest.mark.skipif(psycopg2_version() < (2, 7), reason="Test requires psycopg 2.7+")
class CursorWrapperTestCase(TestCase):
    def test_null_bytes(self):
        from django.db import connection

        cursor = connection.cursor()
        cursor.execute("SELECT %s", [b"Ma\x00tt"])
        assert force_bytes(cursor.fetchone()[0]) == b"Matt"

        cursor.execute("SELECT %s", [u"Ma\x00tt"])
        assert cursor.fetchone()[0] == u"Matt"

    def test_null_bytes_at_max_len_bytes(self):
        from django.db import connection

        cursor = connection.cursor()

        long_str = (b"a" * (MAX_CULPRIT_LENGTH - 1)) + b"\x00"
        assert len(long_str) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %s", [long_str])
        long_str_from_db = force_bytes(cursor.fetchone()[0])
        assert long_str_from_db == (b"a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

    def test_null_bytes_at_max_len_unicode(self):
        from django.db import connection

        cursor = connection.cursor()

        long_str = (u"a" * (MAX_CULPRIT_LENGTH - 1)) + u"\x00"
        assert len(long_str) <= MAX_CULPRIT_LENGTH

        cursor.execute("SELECT %s", [long_str])
        long_str_from_db = cursor.fetchone()[0]
        assert long_str_from_db == (u"a" * (MAX_CULPRIT_LENGTH - 1))
        assert len(long_str_from_db) <= MAX_CULPRIT_LENGTH

    def test_lone_surrogates(self):
        from django.db import connection

        cursor = connection.cursor()

        bad_str = u"Hello\ud83dWorld🇦🇹!"
        cursor.execute("SELECT %s", [bad_str])
        bad_str_from_db = force_text(cursor.fetchone()[0])
        assert bad_str_from_db == u"HelloWorld🇦🇹!"
