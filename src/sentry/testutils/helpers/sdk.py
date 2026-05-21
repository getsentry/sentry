from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

import sentry_sdk


@contextmanager
def reset_trace_context() -> Generator[None]:
    """
    Context manager that isolates the SDK scope AND clears any inherited span.

    ``sentry_sdk.isolation_scope()`` forks (shallow-copies) the current scope,
    which means any active span is carried over.  This wrapper also sets
    ``scope.span = None`` so that ``get_trace_id()`` returns ``None`` inside
    the block — which is the expected state when no span is active.

    Usage::

        with reset_trace_context():
            handler.emit(record, logger=logger)
    """
    with sentry_sdk.isolation_scope():
        sentry_sdk.get_current_scope().span = None
        yield
