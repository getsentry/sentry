"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import difflib
import os
import sys
import threading
import traceback
from contextlib import contextmanager
from logging import getLogger
from traceback import StackSummary
from typing import Any
from unittest import mock

import pytest

### from sentry.utils.arroyo_producer import SingletonProducer  # HAX

_CWD = os.getcwd() + "/"
log = getLogger(__name__)

# a set of "not our code" directories, suitable for str.startswith()
_STDLIB_PATH = getattr(sys, "_stdlib_dir", None)


def _relevant_frames(stack: StackSummary) -> StackSummary:
    for filter in (
        lambda frame: frame.filename == __file__,
        lambda frame: _STDLIB_PATH and frame.filename.startswith(_STDLIB_PATH + "/"),
        lambda frame: frame.filename.startswith(sys.prefix),
        lambda frame: frame.line is None,
    ):
        filtered_stack = [frame for frame in stack if not filter(frame)]
        if filtered_stack:
            stack = StackSummary.from_list(filtered_stack)
        else:
            break

    filtered_stack = [
        traceback.FrameSummary(frame.filename.replace(_CWD, "./"), frame.lineno, frame.name)
        for frame in stack
    ]
    return StackSummary.from_list(filtered_stack[-10:])


def _threads_to_diffable_str(threads: list[threading.Thread]) -> str:
    result: list[str] = []
    for thread in sorted(threads, key=lambda t: t.ident or 0):
        func = getattr(thread, "_target", None)
        if func is None:
            func_fqname = "None"
        else:
            # fallback chiefly for functools.partial
            func_name = getattr(func, "__qualname__", str(func))
            func_fqname = f"{func.__module__}.{func_name}"
        where = getattr(thread, "_where", "")
        if where:
            where = "\n  " + where.replace("\n", "\n  ")
        else:
            where = "\n"
        result.append(
            f"""
{thread!r}@{func_fqname}{where}"""
        )
    return "".join(result)


@contextmanager
def threading_remembers_where():
    """Smuggle a ._where string attribute onto each Thread construction."""
    __init__ = threading.Thread.__init__

    def patched__init__(self: threading.Thread, *a: Any, **k: Any) -> None:
        frames = _relevant_frames(traceback.extract_stack())
        where = "".join(frames.format())
        setattr(self, "_where", where)
        __init__(self, *a, **k)

    with mock.patch.object(threading.Thread, "__init__", patched__init__):
        yield


def diff(left: str, right: str) -> str:
    return "".join(difflib.ndiff(right.splitlines(True), left.splitlines(True)))


@contextmanager
def assert_none():
    with threading_remembers_where():
        expected = _threads_to_diffable_str(threading.enumerate())
        yield
        actual = _threads_to_diffable_str(threading.enumerate())
        if actual != expected:
            # I really need this error to be parseable, and the pytest built-in
            # diff is too buggy.
            raise AssertionError(diff(actual, expected))


# -- pytest support --
def check_test(request: pytest.FixtureRequest):
    if request.node.get_closest_marker("thread_leak_allowlist"):
        yield
    else:
        with assert_none():
            yield
            ### # HAX: close all "singleton producers" before checking thread leaks
            ### # FIXME TODO: if request.node.get_closest_marker("thread_leak_singleton_cleanup"):
            ### SingletonProducer._shutdown_all()


def allowlist(reason: str | None = None, *, issue: int):
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


def singleton_cleanup(reason: str | None = None, *, issue: int):
    decorator = pytest.mark.thread_leak_singleton_cleanup(reason=reason, issue=issue)
    return decorator
