import logging
from collections.abc import Callable, Generator, Sequence
from contextlib import ExitStack, contextmanager
from datetime import timedelta
from functools import wraps
from types import TracebackType
from typing import ParamSpec, TypeVar, cast

from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
from django.db.models import Model
from django.db.utils import OperationalError, ProgrammingError
from sentry_sdk import traces
from sentry_sdk.integrations import Integration

P = ParamSpec("P")
R = TypeVar("R")


@contextmanager
def statement_timeout(alias: str, timeout: timedelta) -> Generator[None]:
    """
    Bound every query in this block server-side.

    A task deadline alone would abandon the query while the database kept executing
    it. `SET LOCAL` cancels it for real, and confines the setting to the surrounding
    transaction so it cannot leak into other work that reuses the connection.

    Raises ``OperationalError`` on expiry, so reporting callers should catch it.
    """
    with transaction.atomic(using=alias):
        with connections[alias].cursor() as cursor:
            cursor.execute(
                "SET LOCAL statement_timeout = %s", [int(timeout.total_seconds() * 1000)]
            )
        yield


def handle_db_failure(
    func: Callable[P, R], model: type[Model], wrap_in_transaction: bool = True
) -> Callable[P, R | None]:
    @wraps(func)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> R | None:
        try:
            if wrap_in_transaction:
                with transaction.atomic(router.db_for_write(model)):
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except (ProgrammingError, OperationalError):
            logging.exception("Failed processing signal %s", func.__name__)
            return None

    return wrapped


def atomic_transaction(
    using: str | Sequence[str], savepoint: bool = True
) -> transaction.Atomic | ExitStack:
    """
    Open transaction to one or multiple databases.

    Usage:

    >>> atomic_transaction(using=router.db_for_write(File))
    >>> atomic_transaction(using=(router.db_for_write(Release), router.db_for_write(ReleaseFile)))

    """
    if isinstance(using, str):
        return transaction.atomic(using=using, savepoint=savepoint)

    stack = ExitStack()
    # dict.fromkeys -> deduplicate while preserving order
    for db in dict.fromkeys(using):
        stack.enter_context(transaction.atomic(using=db, savepoint=savepoint))
    return stack


class DjangoAtomicIntegration(Integration):
    identifier = "django_atomic"

    @staticmethod
    def setup_once() -> None:
        from django.db.transaction import Atomic

        original_enter = Atomic.__enter__
        original_exit = Atomic.__exit__

        def _enter(self: Atomic) -> None:
            span = traces.start_span(
                name="transaction.atomic",
                attributes={
                    "sentry.op": "transaction.atomic",
                    "using": cast(str, self.using),
                },
            )
            span.__enter__()
            setattr(self, "_sentry_sdk_span", span)
            return original_enter(self)

        def _exit(
            self: Atomic,
            exc_type: type[BaseException] | None,
            exc_value: BaseException | None,
            traceback: TracebackType | None,
        ) -> None:
            rv = original_exit(self, exc_type, exc_value, traceback)
            span = getattr(self, "_sentry_sdk_span", None)
            if span is not None:
                span.__exit__(exc_type, exc_value, traceback)
                delattr(self, "_sentry_sdk_span")
            return rv

        Atomic.__enter__ = _enter  # type: ignore[method-assign]
        Atomic.__exit__ = _exit  # type: ignore[method-assign]


def table_exists(name: str, using: str = DEFAULT_DB_ALIAS) -> bool:
    return name in connections[using].introspection.table_names()
