from __future__ import annotations

from collections.abc import Callable, Iterable, Iterator
from typing import Any

import psycopg2
from django.db.backends.postgresql.base import DatabaseWrapper as DjangoDatabaseWrapper
from django.db.backends.postgresql.operations import DatabaseOperations
from taskbroker_client.state import current_task

from sentry.utils import metrics
from sentry.utils.strings import strip_lone_surrogates

from .decorators import auto_reconnect_connection, auto_reconnect_cursor
from .schema import DatabaseSchemaEditorProxy

__all__ = ("DatabaseWrapper",)

SAVEPOINT_DISTRIBUTION_MIN = 10
# Postgres caches 64 subtransaction ids per backend; past that, every snapshot falls back to pg_subtrans.
SAVEPOINT_CACHE_SIZE = 64


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


def _savepoint_metric_tags(alias: str) -> dict[str, str]:
    task = current_task()
    if task is None:
        taskname = "none"
    else:
        taskname = task.taskname
    return {"taskname": taskname, "alias": alias}


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
    def execute(self, sql: str, params: object = None) -> Any:
        if params is not None:
            return self.cursor.execute(sql, params)
        return self.cursor.execute(sql)

    @auto_reconnect_cursor
    def executemany(self, sql: str, paramlist: Iterable[object] = ()) -> Any:
        return self.cursor.executemany(sql, paramlist)


class DatabaseWrapper(DjangoDatabaseWrapper):
    SchemaEditorClass = DatabaseSchemaEditorProxy  # type: ignore[assignment]
    queries_limit = 15000

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.ops = DatabaseOperations(self)
        self.execute_wrappers.extend((_execute__include_sql_in_error, _execute__clean_params))
        self.savepoint_count = 0

    @auto_reconnect_connection
    def _cursor(self, *args: Any, **kwargs: Any) -> Any:
        return super()._cursor()  # type: ignore[misc]

    # We're overriding this internal method that's present in Django 1.11+, because
    # things were shuffled around since 1.10 resulting in not constructing a django CursorWrapper
    # with our CursorWrapper. We need to be passing our wrapped cursor to their wrapped cursor,
    # not the other way around since then we'll lose things like __enter__ due to the way this
    # wrapper is working (getattr on self.cursor).
    def _prepare_cursor(self, cursor: Any) -> Any:
        cursor = super()._prepare_cursor(CursorWrapper(self, cursor))  # type: ignore[misc]
        return cursor

    def _savepoint(self, sid: str) -> None:
        super()._savepoint(sid)
        self.savepoint_count += 1
        if self.savepoint_count == SAVEPOINT_CACHE_SIZE + 1:
            tags = _savepoint_metric_tags(self.alias)
            metrics.incr("db.transaction.savepoint_overflow", tags=tags)

    def _commit(self) -> None:
        try:
            super()._commit()
        finally:
            self._end_savepoint_count()

    def _rollback(self) -> None:
        try:
            super()._rollback()
        finally:
            self._end_savepoint_count()

    def _end_savepoint_count(self) -> None:
        savepoint_count = self.savepoint_count
        self.savepoint_count = 0
        if savepoint_count >= SAVEPOINT_DISTRIBUTION_MIN:
            tags = _savepoint_metric_tags(self.alias)
            metrics.distribution("db.transaction.savepoints", savepoint_count, tags=tags)

    def close(self, reconnect: bool = False) -> None:
        """
        This ensures we don't error if the connection has already been closed.
        """
        self._end_savepoint_count()
        if self.connection is not None:
            if not self.connection.closed:
                try:
                    self.connection.close()
                except psycopg2.InterfaceError:
                    # connection was already closed by something
                    # like pgbouncer idle timeout.
                    pass
            self.connection = None
