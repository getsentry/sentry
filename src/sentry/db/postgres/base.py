from types import TracebackType
from typing import Self

import psycopg2
from django.db.backends.postgresql.base import DatabaseWrapper as DjangoDatabaseWrapper
from django.db.backends.postgresql.operations import DatabaseOperations

from sentry.utils.strings import strip_lone_surrogates

from .decorators import (
    auto_reconnect_connection,
    auto_reconnect_cursor,
    capture_transaction_exceptions,
    more_better_error_messages,
)
from .schema import DatabaseSchemaEditorProxy

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
    # Support dictionary of parameters for %(key)s placeholders
    # in raw SQL queries.
    if isinstance(params, dict):
        for key, param in params.items():
            if isinstance(param, (str, bytes)):
                params[key] = remove_null(remove_surrogates(param))
        return params

    params = list(params)
    for idx, param in enumerate(params):
        if isinstance(param, (str, bytes)):
            params[idx] = remove_null(remove_surrogates(param))
    return params


class CursorWrapper:
    """A wrapper around the postgresql_psycopg2 backend which handles auto reconnects"""

    def __init__(self, db, cursor):
        self.db = db
        self.cursor = cursor

    def __getattr__(self, attr):
        return getattr(self.cursor, attr)

    def __iter__(self):
        return iter(self.cursor)

    def __enter__(self) -> Self:
        self.cursor.__enter__()
        return self

    def __exit__(
        self,
        type: type[BaseException] | None,
        value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return self.cursor.__exit__(type, value, traceback)

    @capture_transaction_exceptions
    @auto_reconnect_cursor
    @more_better_error_messages
    def execute(self, sql, params=None):
        if params is not None:
            return self.cursor.execute(sql, clean_bad_params(params))
        return self.cursor.execute(sql)

    @capture_transaction_exceptions
    @auto_reconnect_cursor
    @more_better_error_messages
    def executemany(self, sql, paramlist=()):
        return self.cursor.executemany(sql, paramlist)


class DatabaseWrapper(DjangoDatabaseWrapper):
    SchemaEditorClass = DatabaseSchemaEditorProxy  # type: ignore[assignment]  # a proxy class isn't exactly the original type
    queries_limit = 15000

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ops = DatabaseOperations(self)

    @auto_reconnect_connection
    def cursor(self) -> CursorWrapper:
        return CursorWrapper(self, super().cursor())

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
