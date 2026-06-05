from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

import sentry_sdk


@contextmanager
def reset_trace_context() -> Generator[None]:
    """
    Context manager that isolates the SDK scope and starts a new trace
    so that ``get_trace_id()`` returns ``None`` inside the block.

    Usage::

        with reset_trace_context():
            handler.emit(record, logger=logger)
    """
    with sentry_sdk.isolation_scope():
        sentry_sdk.traces.new_trace()
        yield
