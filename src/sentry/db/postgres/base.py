from __future__ import absolute_import

from six import string_types, binary_type
import psycopg2 as Database

# Some of these imports are unused, but they are inherited from other engines
# and should be available as part of the backend ``base.py`` namespace.
from django.db.backends.postgresql_psycopg2.base import DatabaseWrapper

from .decorators import (
    capture_transaction_exceptions,
    auto_reconnect_cursor,
    auto_reconnect_connection,
    less_shitty_error_messages,
)
from .operations import DatabaseOperations

from sentry.utils.strings import strip_lone_surrogates

__all__ = ("DatabaseWrapper",)


def remove_null(value):
    # In psycopg2 2.7+, behavior was introduced where a
    # NULL byte in a parameter would start raising a ValueError.
    # psycopg2 chose to do this rather than let Postgres silently
    # truncate the data, which is it's behavior when it sees a
    # NULL byte. But for us, we'd rather remove the null value so it's
    # somewhat legible rather than error. Considering this is better
    # behavior than the database truncating, seems good to do this
    # rather than attempting to sanitize all data inputs now manually.
    if type(value) is bytes:
        return value.replace(b"\x00", b"")
    return value.replace("\x00", "")


def remove_surrogates(value):
    # Another hack.  postgres does not accept lone surrogates
    # in utf-8 mode.  If we encounter any lone surrogates in
    # our string we need to remove it.
    if type(value) is bytes:
        try:
            return strip_lone_surrogates(value.decode("utf-8")).encode("utf-8")
        except UnicodeError:
            return value
    return strip_lone_surrogates(value)


def clean_bad_params(params):
    params = list(params)
    for idx, param in enumerate(params):
        if isinstance(param, (string_types, binary_type)):
            params[idx] = remove_null(remove_surrogates(param))
    return params


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
            return self.cursor.execute(sql, clean_bad_params(params))
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
        return super(DatabaseWrapper, self)._cursor()

    # We're overriding this internal method that's present in Django 1.11+, because
    # things were shuffled around since 1.10 resulting in not constructing a django CursorWrapper
    # with our CursorWrapper. We need to be passing our wrapped cursor to their wrapped cursor,
    # not the other way around since then we'll lose things like __enter__ due to the way this
    # wrapper is working (getattr on self.cursor).
    def _prepare_cursor(self, cursor):
        cursor = super(DatabaseWrapper, self)._prepare_cursor(CursorWrapper(self, cursor))
        return cursor

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
