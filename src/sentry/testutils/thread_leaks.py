"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import sys
import threading
import traceback
from contextlib import contextmanager
from typing import Any
from unittest import mock


def _get_irrelevant_frame_paths() -> tuple[str, ...]:
    result = (
        path + "/"
        for path in (sys.prefix, sys.exec_prefix, getattr(sys, "_stdlib_dir", None))
        if isinstance(path, str)
    )

    return tuple(sorted(set(result)))


# a set of "not our code" directories, suitable for str.startswith()
_IRRELEVANT_FRAME_PATHS = _get_irrelevant_frame_paths()


def _relevant_frames(stack: traceback.StackSummary):
    return [frame for frame in stack[:-1] if not frame.filename.startswith(_IRRELEVANT_FRAME_PATHS)]


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
Thread ID: {thread.ident}
{thread!r}@{func_fqname}{where}"""
        )
    return "".join(result)


@contextmanager
def threading_remembers_where():
    orig = threading.Thread.__init__

    def new(self: threading.Thread, *a: Any, **k: Any) -> None:
        frames = _relevant_frames(traceback.extract_stack())
        setattr(self, "_where", "".join(traceback.format_list(frames)))
        orig(self, *a, **k)

    with mock.patch.object(threading.Thread, "__init__", new):
        yield


@contextmanager
def assert_none():
    with threading_remembers_where():
        expected = _threads_to_diffable_str(threading.enumerate())
        yield
        actual = _threads_to_diffable_str(threading.enumerate())
        assert actual == expected
