"""
Keeps a task's processing deadline from being replaced by a database error.

A deadline that lands while Django ends a transaction block is replaced by whatever Django's
own cleanup raises next. A task that catches ordinary errors then never learns its time is up.
"""

from __future__ import annotations

import contextlib
import logging
import sys
from collections.abc import Iterator
from contextvars import ContextVar
from types import CodeType, TracebackType

from django.db import DEFAULT_DB_ALIAS
from django.db.transaction import Atomic
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MODE_OPTION = "taskworker.deadline_restore.mode"
MODE_OFF = "off"
MODE_REPORT = "report"
MODE_ENFORCE = "enforce"
ACTIVE_MODES = frozenset({MODE_REPORT, MODE_ENFORCE})

MATCHED_METRIC = "taskworker.deadline_restore.matched"

DJANGO_ATOMIC_EXIT_QUALNAME = "Atomic.__exit__"

# A chain of errors can loop back on itself, so the walk through it is bounded
MAX_CHAIN_STEPS = 16

_mode: ContextVar[str] = ContextVar("deadline_restore_mode", default=MODE_OFF)


@contextlib.contextmanager
def task_mode() -> Iterator[None]:
    """The span of one task, during which the rule runs in the mode the option holds."""
    token = _mode.set(_read_mode())
    try:
        yield
    finally:
        _mode.reset(token)


def patch_atomic_exit_to_restore_deadlines() -> None:
    """The wrapper on Django's `Atomic.__exit__` that applies the rule."""
    django_exit = Atomic.__exit__
    django_exit_code = django_exit.__code__

    # The rule recognises Django's own frame, so it has to wrap Django's function directly
    if django_exit_code.co_qualname != DJANGO_ATOMIC_EXIT_QUALNAME:
        raise RuntimeError(
            f"Atomic.__exit__ is already wrapped by {django_exit_code.co_qualname}; "
            "the deadline restore rule must be installed first"
        )

    def exit_restoring_deadlines(
        self: Atomic,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        handled_on_entry = sys.exception()
        try:
            django_exit(self, exc_type, exc_value, traceback)
        except Exception as error:
            mode = _mode.get()
            if mode == MODE_OFF:
                raise

            deadline = _deadline_hidden_by(error, handled_on_entry, exc_value, django_exit_code)
            if deadline is None:
                raise

            _count_match(self.using)

            if mode == MODE_ENFORCE:
                raise deadline
            raise

    Atomic.__exit__ = exit_restoring_deadlines  # type: ignore[method-assign]


def _read_mode() -> str:
    try:
        mode = options.get(MODE_OPTION)
    except Exception:
        logger.exception("taskworker.deadline_restore.mode_read_failed")
        return MODE_OFF

    if mode in ACTIVE_MODES:
        return mode
    return MODE_OFF


def _deadline_hidden_by(
    error: BaseException,
    handled_on_entry: BaseException | None,
    raised_in_block: BaseException | None,
    django_exit_code: CodeType,
) -> ProcessingDeadlineExceeded | None:
    """The deadline that this exit of a block replaced with `error`, if there is one."""
    current = error
    for _ in range(MAX_CHAIN_STEPS):
        previous = _previous_in_chain(current)
        if previous is None:
            return None

        if previous is raised_in_block:
            if isinstance(previous, ProcessingDeadlineExceeded):
                return previous
            return None

        # Anything already being handled when the block ended was not hidden by this exit
        if previous is handled_on_entry:
            return None

        if isinstance(previous, ProcessingDeadlineExceeded):
            if _last_escaped_into(previous, django_exit_code):
                return previous

        current = previous
    return None


def _previous_in_chain(error: BaseException) -> BaseException | None:
    # Django raises its own error `from` the driver's, which hides the driver error's context
    # unless the cause is followed first
    if error.__cause__ is not None:
        return error.__cause__
    if error.__suppress_context__:
        return None
    return error.__context__


def _last_escaped_into(error: BaseException, code: CodeType) -> bool:
    # A deadline the task or a commit hook already caught last escaped into their frame instead
    traceback = error.__traceback__
    if traceback is None:
        return False
    return traceback.tb_frame.f_code is code


def _count_match(using: str | None) -> None:
    try:
        if using is None:
            alias = DEFAULT_DB_ALIAS
        else:
            alias = using

        task = current_task()
        if task is None:
            taskname = "unknown"
        else:
            taskname = task.taskname

        metrics.incr(MATCHED_METRIC, tags={"taskname": taskname, "using": alias}, sample_rate=1.0)
    except Exception:
        logger.exception("taskworker.deadline_restore.metric_failed")
