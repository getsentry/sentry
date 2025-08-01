from collections.abc import Iterable

import psycopg2

# Some of these imports are unused, but they are inherited from other engines
# and should be available as part of the backend ``base.py`` namespace.
from django.db.backends.postgresql.base import DatabaseWrapper as DjangoDatabaseWrapper
from django.db.backends.postgresql.operations import DatabaseOperations

from sentry.utils.strings import strip_lone_surrogates

from .decorators import auto_reconnect_connection, auto_reconnect_cursor, more_better_error_messages
from .schema import DatabaseSchemaEditorProxy

__all__ = ("DatabaseWrapper",)


def remove_null(value: str) -> str:
    # In psycopg2 2.7+, behavior was introduced where a
    # NULL character in a parameter would start raising a ValueError.
    # psycopg2 chose to do this rather than let Postgres silently
    # truncate the data, which is its behavior when it sees a
    # NULL character. But for us, we'd rather remove the null value so it's
    # somewhat legible rather than error. Considering this is better
    # behavior than the database truncating, seems good to do this
    # rather than attempting to sanitize all data inputs now manually.
    return value.replace("\x00", "")


def clean_bad_params(
    params: dict[str, object] | Iterable[object]
) -> dict[str, object] | list[object]:
    # Support dictionary of parameters for %(key)s placeholders
    # in raw SQL queries.
    if isinstance(params, dict):
        for key, param in params.items():
            if isinstance(param, str):
                params[key] = remove_null(strip_lone_surrogates(param))
        return params

    params = list(params)
    for idx, param in enumerate(params):
        if isinstance(param, str):
            params[idx] = remove_null(strip_lone_surrogates(param))
    return params


class CursorWrapper:
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

    @auto_reconnect_cursor
    @more_better_error_messages
    def execute(self, sql, params=None):
        if params is not None:
            return self.cursor.execute(sql, clean_bad_params(params))
        return self.cursor.execute(sql)

    @auto_reconnect_cursor
    @more_better_error_messages
    def executemany(self, sql, paramlist=()):
        return self.cursor.executemany(sql, paramlist)


class DatabaseWrapper(DjangoDatabaseWrapper):
    SchemaEditorClass = DatabaseSchemaEditorProxy
    queries_limit = 15000

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ops = DatabaseOperations(self)

    @auto_reconnect_connection
    def _cursor(self, *args, **kwargs):
        return super()._cursor()

    # We're overriding this internal method that's present in Django 1.11+, because
    # things were shuffled around since 1.10 resulting in not constructing a django CursorWrapper
    # with our CursorWrapper. We need to be passing our wrapped cursor to their wrapped cursor,
    # not the other way around since then we'll lose things like __enter__ due to the way this
    # wrapper is working (getattr on self.cursor).
    def _prepare_cursor(self, cursor):
        cursor = super()._prepare_cursor(CursorWrapper(self, cursor))
        return cursor

    def close(self, reconnect=False):
        """
        This ensures we don't error if the connection has already been closed.
        """
        if self.connection is not None:
            if not self.connection.closed:
                try:
                    self.connection.close()
                except psycopg2.InterfaceError:
                    # connection was already closed by something
                    # like pgbouncer idle timeout.
                    pass
            self.connection = None
