"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import threading
import traceback
from collections.abc import Generator
from contextlib import contextmanager
from threading import Thread
from traceback import StackSummary
from typing import int, Any
from unittest import mock

from ._constants import CWD
from .diff import diff


class ThreadLeakAssertionError(AssertionError):
    def __init__(self, diff: str, thread_leaks: set[Thread]):
        super().__init__(diff)
        self.thread_leaks = thread_leaks


def _where(cwd: str = CWD) -> StackSummary:
    stack = traceback.extract_stack()
    for frame in stack:
        frame.filename = frame.filename.replace(cwd, "./")  # for readability
    return stack


@contextmanager
def threading_remembers_where() -> Generator[None]:
    """Smuggle a ._where StackSummary attribute onto each Thread construction."""
    __init__ = Thread.__init__

    def patched__init__(self: Thread, *a: Any, **k: Any) -> None:
        setattr(self, "_where", _where())
        __init__(self, *a, **k)

    with mock.patch.object(Thread, "__init__", patched__init__):
        yield


@contextmanager
def assert_none() -> Generator[None]:
    """Assert no thread leaks occurred during context execution."""

    with threading_remembers_where():
        expected = threading.enumerate()
        yield
        actual = threading.enumerate()

        thread_leaks = set(actual) - set(expected)
        if thread_leaks:
            raise ThreadLeakAssertionError(diff(old=expected, new=actual), thread_leaks)
