"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import os
import sys
import threading
import traceback
from contextlib import contextmanager
from traceback import StackSummary
from typing import Any
from unittest import mock

_CWD = os.getcwd() + "/"


def _get_third_party_frame_paths() -> frozenset[str]:
    """Get all path prefixes that indicate stdlib or third-party code."""
    return frozenset(
        path + "/"
        for path in (sys.prefix, sys.exec_prefix, getattr(sys, "_stdlib_dir", None))
        if isinstance(path, str)
    )


# a set of "not our code" directories, suitable for str.startswith()
_THIRD_PARTY_FRAME_PATHS = tuple(_get_third_party_frame_paths())


def _relevant_frames(stack: StackSummary) -> StackSummary:
    return StackSummary.from_list(
        traceback.FrameSummary(frame.filename.replace(_CWD, "./"), frame.lineno, frame.name)
        for frame in stack
        if (
            not frame.filename.startswith(_THIRD_PARTY_FRAME_PATHS)
            and not frame.filename == __file__
            and frame.line is not None  # e.g. "frozen" modules
        )
    )


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


@contextmanager
def assert_none():
    with threading_remembers_where():
        expected = _threads_to_diffable_str(threading.enumerate())
        yield
        actual = _threads_to_diffable_str(threading.enumerate())
        assert actual == expected
