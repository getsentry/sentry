from __future__ import absolute_import

from six import string_types
import psycopg2 as Database

# Some of these imports are unused, but they are inherited from other engines
# and should be available as part of the backend ``base.py`` namespace.
from django.db.backends.postgresql_psycopg2.base import DatabaseWrapper

from .decorators import (
    capture_transaction_exceptions, auto_reconnect_cursor, auto_reconnect_connection,
    less_shitty_error_messages
)
from .operations import DatabaseOperations

__all__ = ('DatabaseWrapper', )


def remove_null(value):
    if not isinstance(value, string_types):
        return value
    return value.replace('\x00', '')


class CursorWrapper(object):
    """
    A wrapper around the postgresql_psycopg2 backend which handles various events
    from cursors, such as auto reconnects and lazy time zone evaluation.
    """

    def __init__(self, db, cursor):
        self.db = db
        self.cursor = cursor

    def __getattr__(self, attr):
        return getattr(self.cursor, attr)

    def __iter__(self):
        return iter(self.cursor)

    @capture_transaction_exceptions
    @auto_reconnect_cursor
    @less_shitty_error_messages
    def execute(self, sql, params=None):
        if params is not None:
            try:
                return self.cursor.execute(sql, params)
            except ValueError as e:
                # In psycopg2 2.7+, behavior was introduced where a
                # NULL byte in a parameter would start raising a ValueError.
                # psycopg2 chose to do this rather than let Postgres silently
                # truncate the data, which is it's behavior when it sees a
                # NULL byte. But for us, we'd rather remove the null value so it's
                # somewhat legible rather than error. Considering this is better
                # behavior than the database truncating, seems good to do this
                # rather than attempting to sanitize all data inputs now manually.

                # Note: This message is brittle, but it's currently hardcoded into
                # psycopg2 for this behavior. If anything changes, we're choosing to
                # address that later rather than potentially catch incorrect behavior.
                if e.message != 'A string literal cannot contain NUL (0x00) characters.':
                    raise
                return self.cursor.execute(sql, [remove_null(param) for param in params])
        return self.cursor.execute(sql)

    @capture_transaction_exceptions
    @auto_reconnect_cursor
    @less_shitty_error_messages
    def executemany(self, sql, paramlist=()):
        return self.cursor.executemany(sql, paramlist)


class DatabaseWrapper(DatabaseWrapper):
    def __init__(self, *args, **kwargs):
        super(DatabaseWrapper, self).__init__(*args, **kwargs)
        self.ops = DatabaseOperations(self)

    @auto_reconnect_connection
    def _set_isolation_level(self, level):
        return super(DatabaseWrapper, self)._set_isolation_level(level)

    @auto_reconnect_connection
    def _cursor(self, *args, **kwargs):
        cursor = super(DatabaseWrapper, self)._cursor()
        return CursorWrapper(self, cursor)

    def close(self, reconnect=False):
        """
        This ensures we dont error if the connection has already been closed.
        """
        if self.connection is not None:
            if not self.connection.closed:
                try:
                    self.connection.close()
                except Database.InterfaceError:
                    # connection was already closed by something
                    # like pgbouncer idle timeout.
                    pass
            self.connection = None
