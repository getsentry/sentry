"""
Keeps a task's processing deadline from being replaced by a database error.

A deadline that lands while Django ends a transaction block is replaced by whatever Django's
cleanup raises next, so a task that catches ordinary errors never learns its time is up.
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

# Bounds the walk through a chain of errors, which can loop back on itself
MAX_CHAIN_STEPS = 16

_mode: ContextVar[str] = ContextVar("deadline_restore_mode", default=MODE_OFF)


@contextlib.contextmanager
def task_mode() -> Iterator[None]:
    """The span of one task, with the mode read from the option once at its start."""
    token = _mode.set(_read_mode())
    try:
        yield
    finally:
        _mode.reset(token)


def patch_atomic_exit_to_restore_deadlines() -> None:
    """The install of the rule, as a wrapper on Django's `Atomic.__exit__`."""
    django_exit = Atomic.__exit__
    django_exit_code = django_exit.__code__

    # Wrapped around another wrapper, the rule would never see Django's own frame and never match
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
        handled_before_exit = sys.exception()
        try:
            django_exit(self, exc_type, exc_value, traceback)
        except Exception as error:
            mode = _mode.get()
            if mode == MODE_OFF:
                raise

            deadline = _deadline_hidden_by(error, exc_value, handled_before_exit, django_exit_code)
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
    raised_in_block: BaseException | None,
    handled_before_exit: BaseException | None,
    django_exit_code: CodeType,
) -> ProcessingDeadlineExceeded | None:
    """The deadline that this exit of a block replaced with `error`, if there is one."""
    newer = error
    for _ in range(MAX_CHAIN_STEPS):
        # The context of an error is the error that was in flight when it was raised
        replaced = newer.__context__
        if replaced is None:
            return None

        # The block's own error is the oldest one this exit could have replaced
        if replaced is raised_in_block:
            if isinstance(replaced, ProcessingDeadlineExceeded):
                return replaced
            return None

        # Already in flight before this exit began, so it is still its own handler's to raise
        if replaced is handled_before_exit:
            return None

        # A deadline that landed during this exit counts only when Django's cleanup replaced it
        if isinstance(replaced, ProcessingDeadlineExceeded):
            if _stopped_in(replaced, django_exit_code):
                return replaced

        newer = replaced
    return None


def _stopped_in(error: BaseException, code: CodeType) -> bool:
    # A traceback starts at the last frame its error reached: the one that caught or replaced it
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
