import logging
import math
from collections.abc import Callable, Generator, Sequence
from contextlib import AbstractContextManager, ExitStack, contextmanager
from datetime import timedelta
from functools import wraps
from time import monotonic

from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
from django.db.utils import OperationalError, ProgrammingError
from sentry_sdk.integrations import Integration

from sentry.utils.env import in_test_environment
from sentry.utils.tracing import set_span_data, start_span


class StatementTimeoutBudgetExceeded(OperationalError):
    pass


def _has_open_transaction(alias: str) -> bool:
    if in_test_environment():
        from sentry.testutils.hybrid_cloud import (  # NOQA:S007
            simulated_transaction_watermarks,
        )

        return (
            simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
                using=alias
            )
            > 0
        )

    return transaction.get_connection(alias).in_atomic_block


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


def make_statement_timeout_budget(
    timeout: timedelta, *, using: str = DEFAULT_DB_ALIAS
) -> Callable[[], AbstractContextManager[None]]:
    """Create a reusable context manager source bounded by one shared deadline.

    Each use opens a short transaction and applies the time remaining as a
    server-side statement timeout. Keep one database statement in each context;
    multiple statements would each receive the same remaining timeout.

    This cannot be used within an existing transaction because ``SET LOCAL``
    would remain active until that outer transaction ended. Catch timeout errors
    outside the returned context so its transaction can roll back first.
    """
    deadline = monotonic() + timeout.total_seconds()

    @contextmanager
    def budgeted_statement() -> Generator[None]:
        if _has_open_transaction(using):
            raise RuntimeError("statement timeout budget cannot be used inside an open transaction")

        remaining_ms = math.floor((deadline - monotonic()) * 1000)
        if remaining_ms < 1:
            raise StatementTimeoutBudgetExceeded("statement timeout budget exhausted")

        with transaction.atomic(using=using):
            with connections[using].cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = %s", [remaining_ms])
            yield

    return budgeted_statement


def handle_db_failure(func, model, wrap_in_transaction: bool = True):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            if wrap_in_transaction:
                with transaction.atomic(router.db_for_write(model)):
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except (ProgrammingError, OperationalError):
            logging.exception("Failed processing signal %s", func.__name__)
            return

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
    def setup_once():
        from django.db.transaction import Atomic

        original_enter = Atomic.__enter__
        original_exit = Atomic.__exit__

        def _enter(self):
            self._sentry_sdk_span = start_span(op="transaction.atomic", name="transaction.atomic")
            set_span_data(self._sentry_sdk_span, "using", self.using)
            self._sentry_sdk_span.__enter__()
            return original_enter(self)

        def _exit(self, exc_type, exc_value, traceback):
            rv = original_exit(self, exc_type, exc_value, traceback)
            if hasattr(self, "_sentry_sdk_span"):
                self._sentry_sdk_span.__exit__(exc_type, exc_value, traceback)
                del self._sentry_sdk_span
            return rv

        Atomic.__enter__ = _enter  # type: ignore[method-assign]
        Atomic.__exit__ = _exit  # type: ignore[method-assign]


def table_exists(name, using=DEFAULT_DB_ALIAS):
    return name in connections[using].introspection.table_names()
