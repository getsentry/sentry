from __future__ import absolute_import

import pytest
from sentry.utils.db import is_postgres
from sentry.testutils import TestCase


def psycopg2_version():
    import psycopg2
    version = psycopg2.__version__.split()[0].split('.')
    return tuple(map(int, version))


@pytest.mark.skipif(
    not is_postgres() or psycopg2_version() < (2, 7),
    reason='Test requires Postgres and psycopg 2.7+',
)
class CursorWrapperTestCase(TestCase):
    def test_null_bytes(self):
        from django.db import connection
        cursor = connection.cursor()
        cursor.execute('SELECT %s', [b'Ma\x00tt'])
        assert cursor.fetchone()[0] == b'Ma\\x00tt'
        cursor.execute('SELECT %s', [u'Ma\x00tt'])
        assert cursor.fetchone()[0] == u'Ma\\x00tt'
