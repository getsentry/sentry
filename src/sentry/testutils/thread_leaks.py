"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import threading
import traceback
from contextlib import contextmanager
from typing import Any
from unittest import mock


def _threads_to_diffable_str(threads: list[threading.Thread]) -> str:
    result: list[str] = []
    for thread in sorted(threads, key=lambda t: t.ident or 0):
        func = getattr(thread, "_target", None)
        if func is None:
            func_name = "None"
        else:
            func_name = f"@{func.__module__}.{func.__qualname__}"
        where = getattr(thread, "_where", "")
        if where:
            where = "\n  " + where.replace("\n", "\n  ")
        else:
            where = "\n"
        result.append(
            f"""
Thread ID: {thread.ident}
{thread!r}@{func_name}{where}"""
        )
    return "".join(result)


@contextmanager
def threading_remembers_where():
    orig = threading.Thread.__init__

    def new(self: threading.Thread, *a: Any, **k: Any) -> None:
        stack = traceback.extract_stack(limit=6)[:-1]
        setattr(self, "_where", "".join(traceback.format_list(stack)))
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
