from __future__ import annotations
import contextlib
from typing import Any, TypeVar, Callable, Awaitable, Iterator, Optional

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP, SPANDATA
from sentry_sdk_alpha.integrations import _check_minimum_version, Integration, DidNotEnable
from sentry_sdk_alpha.tracing import Span
from sentry_sdk_alpha.tracing_utils import add_query_source, record_sql_queries
from sentry_sdk_alpha.utils import (
    _serialize_span_attribute,
    ensure_integration_enabled,
    parse_version,
    capture_internal_exceptions,
)

try:
    import asyncpg  # type: ignore[import-not-found]
    from asyncpg.cursor import BaseCursor  # type: ignore

except ImportError:
    raise DidNotEnable("asyncpg not installed.")


class AsyncPGIntegration(Integration):
    identifier = "asyncpg"
    origin = f"auto.db.{identifier}"
    _record_params = False

    def __init__(self, *, record_params: bool = False):
        AsyncPGIntegration._record_params = record_params

    @staticmethod
    def setup_once() -> None:
        # asyncpg.__version__ is a string containing the semantic version in the form of "<major>.<minor>.<patch>"
        asyncpg_version = parse_version(asyncpg.__version__)
        _check_minimum_version(AsyncPGIntegration, asyncpg_version)

        asyncpg.Connection.execute = _wrap_execute(
            asyncpg.Connection.execute,
        )
        asyncpg.Connection._execute = _wrap_connection_method(
            asyncpg.Connection._execute
        )
        asyncpg.Connection._executemany = _wrap_connection_method(
            asyncpg.Connection._executemany, executemany=True
        )
        asyncpg.Connection.cursor = _wrap_cursor_creation(asyncpg.Connection.cursor)
        asyncpg.Connection.prepare = _wrap_connection_method(asyncpg.Connection.prepare)
        asyncpg.connect_utils._connect_addr = _wrap_connect_addr(
            asyncpg.connect_utils._connect_addr
        )


T = TypeVar("T")


def _wrap_execute(f: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
    async def _inner(*args: Any, **kwargs: Any) -> T:
        if sentry_sdk_alpha.get_client().get_integration(AsyncPGIntegration) is None:
            return await f(*args, **kwargs)

        # Avoid recording calls to _execute twice.
        # Calls to Connection.execute with args also call
        # Connection._execute, which is recorded separately
        # args[0] = the connection object, args[1] is the query
        if len(args) > 2:
            return await f(*args, **kwargs)

        query = args[1]
        with record_sql_queries(
            cursor=None,
            query=query,
            params_list=None,
            paramstyle=None,
            executemany=False,
            span_origin=AsyncPGIntegration.origin,
        ) as span:
            res = await f(*args, **kwargs)

            with capture_internal_exceptions():
                add_query_source(span)

        return res

    return _inner


SubCursor = TypeVar("SubCursor", bound=BaseCursor)


@contextlib.contextmanager
def _record(
    cursor: SubCursor | None,
    query: str,
    params_list: tuple[Any, ...] | None,
    *,
    executemany: bool = False,
) -> Iterator[Span]:
    integration = sentry_sdk_alpha.get_client().get_integration(AsyncPGIntegration)
    if integration is not None and not integration._record_params:
        params_list = None

    param_style = "pyformat" if params_list else None

    with record_sql_queries(
        cursor=cursor,
        query=query,
        params_list=params_list,
        paramstyle=param_style,
        executemany=executemany,
        record_cursor_repr=cursor is not None,
        span_origin=AsyncPGIntegration.origin,
    ) as span:
        yield span


def _wrap_connection_method(
    f: Callable[..., Awaitable[T]], *, executemany: bool = False
) -> Callable[..., Awaitable[T]]:
    async def _inner(*args: Any, **kwargs: Any) -> T:
        if sentry_sdk_alpha.get_client().get_integration(AsyncPGIntegration) is None:
            return await f(*args, **kwargs)

        query = args[1]
        params_list = args[2] if len(args) > 2 else None

        with _record(None, query, params_list, executemany=executemany) as span:
            data = _get_db_data(conn=args[0])
            _set_on_span(span, data)
            res = await f(*args, **kwargs)

        return res

    return _inner


def _wrap_cursor_creation(f: Callable[..., T]) -> Callable[..., T]:
    @ensure_integration_enabled(AsyncPGIntegration, f)
    def _inner(*args: Any, **kwargs: Any) -> T:  # noqa: N807
        query = args[1]
        params_list = args[2] if len(args) > 2 else None

        with _record(
            None,
            query,
            params_list,
            executemany=False,
        ) as span:
            data = _get_db_data(conn=args[0])
            _set_on_span(span, data)
            res = f(*args, **kwargs)
            span.set_attribute("db.cursor", _serialize_span_attribute(res))

        return res

    return _inner


def _wrap_connect_addr(f: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
    async def _inner(*args: Any, **kwargs: Any) -> T:
        if sentry_sdk_alpha.get_client().get_integration(AsyncPGIntegration) is None:
            return await f(*args, **kwargs)

        with sentry_sdk_alpha.start_span(
            op=OP.DB,
            name="connect",
            origin=AsyncPGIntegration.origin,
            only_if_parent=True,
        ) as span:
            data = _get_db_data(
                addr=kwargs.get("addr"),
                database=kwargs["params"].database,
                user=kwargs["params"].user,
            )
            _set_on_span(span, data)

            with capture_internal_exceptions():
                sentry_sdk_alpha.add_breadcrumb(
                    message="connect", category="query", data=data
                )

            res = await f(*args, **kwargs)

        return res

    return _inner


def _get_db_data(
    conn: Any = None,
    addr: Optional[tuple[str, ...]] = None,
    database: Optional[str] = None,
    user: Optional[str] = None,
) -> dict[str, str]:
    if conn is not None:
        addr = conn._addr
        database = conn._params.database
        user = conn._params.user

    data = {
        SPANDATA.DB_SYSTEM: "postgresql",
    }

    if addr:
        try:
            data[SPANDATA.SERVER_ADDRESS] = addr[0]
            data[SPANDATA.SERVER_PORT] = addr[1]
        except IndexError:
            pass

    if database:
        data[SPANDATA.DB_NAME] = database

    if user:
        data[SPANDATA.DB_USER] = user

    return data


def _set_on_span(span: Span, data: dict[str, Any]) -> None:
    for key, value in data.items():
        span.set_attribute(key, value)
