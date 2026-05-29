from __future__ import annotations

from collections.abc import Callable, Iterable, Iterator, Sequence
from typing import Any, cast

import psycopg2
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.backends.postgresql.base import DatabaseWrapper as DjangoDatabaseWrapper
from django.db.backends.postgresql.operations import DatabaseOperations

from sentry.utils.strings import strip_lone_surrogates

from .decorators import auto_reconnect_connection, auto_reconnect_cursor
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
    params: dict[str, object] | Iterable[object] | None,
) -> dict[str, object] | list[object] | None:
    if params is None:
        return None
    # Support dictionary of parameters for %(key)s placeholders
    # in raw SQL queries.
    elif isinstance(params, dict):
        for key, param in params.items():
            if isinstance(param, str):
                params[key] = remove_null(strip_lone_surrogates(param))
        return params
    else:
        params = list(params)
        for idx, param in enumerate(params):
            if isinstance(param, str):
                params[idx] = remove_null(strip_lone_surrogates(param))
        return params


def _execute__clean_params(
    execute: Callable[[str, Any, bool, dict[str, Any]], Any],
    sql: str,
    params: Any,
    many: bool,
    context: dict[str, Any],
) -> Any:
    """execute_wrapper which sanitizes params"""
    return execute(sql, clean_bad_params(params), many, context)


def _execute__include_sql_in_error(
    execute: Callable[[str, Any, bool, dict[str, Any]], Any],
    sql: str,
    params: Any,
    many: bool,
    context: dict[str, Any],
) -> Any:
    """execute_wrapper to include the sql in any exceptions"""
    try:
        return execute(sql, params, many, context)
    except Exception as e:
        e.add_note(f"SQL: {sql}")
        raise


class CursorWrapper:
    """
    A wrapper around the postgresql_psycopg2 backend which handles various events
    from cursors, such as auto reconnects and lazy time zone evaluation.
    """

    def __init__(self, db: DatabaseWrapper, cursor: Any) -> None:
        self.db = db
        self.cursor = cursor

    def __getattr__(self, attr: str) -> Any:
        return getattr(self.cursor, attr)

    def __iter__(self) -> Iterator[Any]:
        return iter(self.cursor)

    @auto_reconnect_cursor
    def execute(self, sql: str, params: Sequence[object] | dict[str, object] | None = None) -> Any:
        if params is not None:
            return self.cursor.execute(sql, params)
        return self.cursor.execute(sql)

    @auto_reconnect_cursor
    def executemany(
        self, sql: str, paramlist: Iterable[Sequence[object] | dict[str, object]] = ()
    ) -> Any:
        return self.cursor.executemany(sql, paramlist)


class DatabaseWrapper(DjangoDatabaseWrapper):
    SchemaEditorClass = cast(type[BaseDatabaseSchemaEditor], DatabaseSchemaEditorProxy)
    queries_limit = 15000

    def __init__(self, settings_dict: dict[str, Any], alias: str = "default") -> None:
        super().__init__(settings_dict=settings_dict, alias=alias)
        self.ops = DatabaseOperations(self)
        self.execute_wrappers.extend((_execute__include_sql_in_error, _execute__clean_params))

    @auto_reconnect_connection
    def _cursor(self, name: str | None = None) -> Any:
        return getattr(super(), "_cursor")(name=name)

    # We're overriding this internal method that's present in Django 1.11+, because
    # things were shuffled around since 1.10 resulting in not constructing a django CursorWrapper
    # with our CursorWrapper. We need to be passing our wrapped cursor to their wrapped cursor,
    # not the other way around since then we'll lose things like __enter__ due to the way this
    # wrapper is working (getattr on self.cursor).
    def _prepare_cursor(self, cursor: Any) -> Any:
        cursor = getattr(super(), "_prepare_cursor")(CursorWrapper(self, cursor))
        return cursor

    def close(self, reconnect: bool = False) -> None:
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
