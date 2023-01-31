import contextlib

from sentry.tasks.deliver_from_outbox import enqueue_outbox_jobs
from sentry.testutils.silo import exempt_from_silo_limits


@contextlib.contextmanager
def outbox_runner():
    """
    A context manager that, upon *successful exit*, executes all pending outbox jobs that are scheduled for
    the current time, synchronously.  Exceptions block further processing as written -- to test retry cases,
    use the inner implementation functions directly.
    """
    yield
    from sentry.testutils.helpers.task_runner import TaskRunner

    with TaskRunner(), exempt_from_silo_limits():
        enqueue_outbox_jobs()
