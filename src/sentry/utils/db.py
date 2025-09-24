import logging
import time
from collections.abc import Callable, Sequence
from contextlib import ExitStack
from functools import wraps
from typing import Any

import sentry_sdk
from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
from django.db.utils import DatabaseError, OperationalError, ProgrammingError
from sentry_sdk.integrations import Integration

from sentry.db.postgres.helpers import can_reconnect


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


def retry_on_connection_failure(
    max_retries: int = 2,
) -> Callable[[Callable[[], Any]], Callable[[], Any]]:
    """
    Retry decorator for database connection failures.

    This handles the specific case of "server closed the connection unexpectedly"
    and other connection issues that can be resolved by retrying the operation.

    Args:
        max_retries: Maximum number of retry attempts (default: 2)

    Returns:
        Decorator function that wraps the target function with retry logic

    Example:
        @retry_on_connection_failure(max_retries=2)
        def get_or_create_something():
            return Model.objects.get_or_create(...)
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (DatabaseError, OperationalError) as e:
                    if attempt == max_retries or not can_reconnect(e):
                        # Either we've exhausted retries or this isn't a recoverable error
                        raise

                    logging.warning(
                        "Database connection failure in %s, retrying (attempt %d/%d): %s",
                        func.__name__,
                        attempt + 1,
                        max_retries,
                        str(e),
                    )
                    # Small delay before retry to allow connection recovery
                    time.sleep(0.1 * (attempt + 1))  # Exponential backoff: 0.1s, 0.2s

            # This should never be reached due to the logic above
            raise RuntimeError("Unexpected retry loop exit")  # type: ignore[misc]

        return wrapper

    return decorator


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
            self._sentry_sdk_span = sentry_sdk.start_span(op="transaction.atomic")
            self._sentry_sdk_span.set_data("using", self.using)
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
