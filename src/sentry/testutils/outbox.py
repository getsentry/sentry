from __future__ import annotations

import contextlib
import functools
from typing import Any

from django.test import override_settings

from sentry.silo import SiloMode
from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs


@contextlib.contextmanager
def outbox_runner(wrapped: Any | None = None) -> Any:
    """
    A context manager that, upon *successful exit*, executes all pending outbox jobs that are scheduled for
    the current time, synchronously.  Exceptions block further processing as written -- to test retry cases,
    use the inner implementation functions directly.
    """
    if callable(wrapped):

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            assert callable(wrapped)
            with outbox_runner():
                return wrapped(*args, **kwargs)

        functools.update_wrapper(wrapper, wrapped)
        return wrapper

    yield
    from sentry.testutils.helpers.task_runner import TaskRunner

    with TaskRunner(), override_settings(SILO_MODE=SiloMode.MONOLITH):
        while enqueue_outbox_jobs():
            pass
