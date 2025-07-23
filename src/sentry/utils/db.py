import logging
from collections.abc import Sequence
from contextlib import ExitStack
from functools import wraps

import sentry_sdk
from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
from django.db.utils import OperationalError, ProgrammingError
from sentry_sdk.integrations import Integration


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
