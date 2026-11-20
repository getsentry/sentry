"""
The mode a task runs the deadline restore rule in.

The option is read once as a task starts and held in the process, so nothing has to read an
option later, while a transaction block is ending on a connection that may be broken.
"""

from __future__ import annotations

import contextlib
import logging
from collections.abc import Iterator
from contextvars import ContextVar

from sentry import options

logger = logging.getLogger(__name__)

MODE_OPTION = "taskworker.deadline_restore.mode"
MODE_OFF = "off"
MODE_REPORT = "report"
MODE_ENFORCE = "enforce"
ACTIVE_MODES = frozenset({MODE_REPORT, MODE_ENFORCE})

_mode: ContextVar[str] = ContextVar("deadline_restore_mode", default=MODE_OFF)


@contextlib.contextmanager
def task_mode() -> Iterator[None]:
    """The span of one task, with the mode read from the option once at its start."""
    token = _mode.set(_read_mode())
    try:
        yield
    finally:
        _mode.reset(token)


def current_mode() -> str:
    """The mode of the task running now, or off outside a task."""
    return _mode.get()


def _read_mode() -> str:
    try:
        mode = options.get(MODE_OPTION)
    except Exception:
        logger.exception("taskworker.deadline_restore.mode_read_failed")
        return MODE_OFF

    if mode in ACTIVE_MODES:
        return mode
    return MODE_OFF
