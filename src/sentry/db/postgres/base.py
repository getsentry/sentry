from __future__ import absolute_import

import psycopg2 as Database

# Some of these imports are unused, but they are inherited from other engines
# and should be available as part of the backend ``base.py`` namespace.
from django.db.backends.postgresql_psycopg2.base import DatabaseWrapper

from .decorators import (
    capture_transaction_exceptions, auto_reconnect_cursor,
    auto_reconnect_connection, less_shitty_error_messages
)
from .operations import DatabaseOperations

__all__ = ('DatabaseWrapper',)


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
            return self.cursor.execute(sql, params)
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
