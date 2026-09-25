"""An exception for reporting PR iteration failures that have no exception of their own.

Some PR iteration failures are noticed by checking a value rather than by
catching an exception, for example a run that is missing the id we expected.
Reported as a plain message, such an event has no exception stack trace, and
Sentry only searches exception stack traces for ``stack.module``. So a
``stack.module:*pr_iteration*`` search, which finds every other PR iteration
error, would miss it. Reporting a raised ``PrIterationError`` instead gives the
event a stack trace that search can find.
"""

from __future__ import annotations


class PrIterationError(Exception):
    """A PR iteration failure that was detected rather than raised."""


def raised_pr_iteration_error(message: str) -> PrIterationError:
    """Return a ``PrIterationError`` that has already been raised and caught.

    An exception that is only created, never raised, has no traceback, so
    Sentry would show it with no stack frames. Raising it here gives it a
    traceback, and the SDK adds the frames of whoever reports it.
    """
    try:
        raise PrIterationError(message)
    except PrIterationError as e:
        return e
