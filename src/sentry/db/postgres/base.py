from __future__ import annotations

import functools
from collections.abc import Callable, Iterable
from typing import Any, Concatenate, Protocol

import psycopg2
from django.db.backends.postgresql.base import DatabaseWrapper as DjangoDatabaseWrapper
from django.db.backends.postgresql.operations import DatabaseOperations
from django.db.backends.utils import CursorWrapper
from django.db.utils import DatabaseError, InterfaceError

from sentry.utils.strings import strip_lone_surrogates

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


def can_reconnect(exc: Exception) -> bool:
    if isinstance(exc, (psycopg2.InterfaceError, InterfaceError)):
        return True
    # elif isinstance(exc, psycopg2.OperationalError):
    #     exc_msg = str(exc)
    #     if "can't fetch default_isolation_level" in exc_msg:
    #         return True
    #     elif "can't set datestyle to ISO" in exc_msg:
    #         return True
    #     return True
    elif isinstance(exc, DatabaseError):
        exc_msg = str(exc)
        if "server closed the connection unexpectedly" in exc_msg:
            return True
        elif "client_idle_timeout" in exc_msg:
            return True
    return False


class _Reconnectable(Protocol):
    def _reconnect(self) -> None: ...


def _auto_reconnect[
    T: _Reconnectable, R, **P
](func: Callable[Concatenate[T, P], R]) -> Callable[Concatenate[T, P], R]:
    @functools.wraps(func)
    def _auto_reconnect_impl(self: T, *args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            if not can_reconnect(e):
                raise
            else:
                self._reconnect()
                return func(self, *args, **kwargs)

    return _auto_reconnect_impl


class SentryCursorWrapper(CursorWrapper):
    """A wrapper around the postgresql_psycopg2 backend which handles auto reconnects"""

    def _reconnect(self) -> None:
        self.db.close(reconnect=True)
        # important: unwrap the cursor or we'll double wrap!
        self.cursor = self.db.cursor().cursor

    @_auto_reconnect
    def execute(self, *args: Any, **kwargs: Any) -> Any:
        return super().execute(*args, **kwargs)

    @_auto_reconnect
    def executemany(self, *args: Any, **kwargs: Any) -> Any:
        return super().executemany(*args, **kwargs)


class DatabaseWrapper(DjangoDatabaseWrapper):
    SchemaEditorClass = DatabaseSchemaEditorProxy  # type: ignore[assignment]  # a proxy class isn't exactly the original type
    queries_limit = 15000

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.ops = DatabaseOperations(self)
        self.execute_wrappers.extend((_execute__include_sql_in_error, _execute__clean_params))

    def _reconnect(self) -> None:
        self.close(reconnect=True)

    @_auto_reconnect
    def cursor(self) -> CursorWrapper:
        return super().cursor()

    def make_cursor(self, cursor: CursorWrapper) -> CursorWrapper:
        return SentryCursorWrapper(cursor, self)

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
