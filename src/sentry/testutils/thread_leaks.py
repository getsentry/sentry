"""Utility used to regression-proof our thread-leak fixes.

It turns out due to various indirections, just showing the name and exact
"target" of a thread isn't enough to find where/how it was spawned. This code
does a bit of work to record and show exactly where the Thread came from, which
proved essential when working to fix these things.
"""

import difflib
import functools
import os
import sys
import threading
import traceback
from collections.abc import Generator
from contextlib import contextmanager
from logging import getLogger
from traceback import StackSummary
from typing import Any
from unittest import mock

import pytest
import sentry_sdk.scope

_CWD = os.getcwd() + "/"
log = getLogger(__name__)


# a set of "not our code" directories, suitable for str.startswith()
_STDLIB_PATH = getattr(sys, "_stdlib_dir", None)


@functools.cache
def get_sentry_scope():
    """Create a Sentry Scope to be used for logging thread leaks."""
    from os import environ

    if environ.get("CI") == "true":
        sha = environ["GITHUB_SHA"]
        branch = environ.get("GITHUB_HEAD_REF")
        if branch:
            environment = "PR"
        else:
            environment = "master"
            branch = environ["GITHUB_REF_NAME"]
    else:
        sha = branch = None
        environment = "local"

    client = sentry_sdk.Client(
        # proj-thread-leaks
        dsn="https://447e81e71c1aa0da0d52f3eaba37a703@o1.ingest.us.sentry.io/4509798820085760",
        environment=environment,
    )

    scope = sentry_sdk.get_current_scope().fork()
    scope.set_client(client)
    scope.update_from_kwargs(
        level="warning",
        extras={"git-branch": branch, "git-sha": sha},
    )
    return scope


def _relevant_frames(stack: StackSummary) -> StackSummary:
    for filter in (
        lambda frame: frame.filename == __file__,
        lambda frame: frame.line is None,  # "frozen" stdlib, generally
        lambda frame: _STDLIB_PATH and frame.filename.startswith(_STDLIB_PATH + "/"),
        lambda frame: frame.filename.startswith(sys.prefix),
        lambda frame: "/test_" not in frame.filename,
        lambda frame: "/testutils/" not in frame.filename,
    ):
        filtered_stack = [frame for frame in stack if not filter(frame)]
        if filtered_stack:
            stack = StackSummary.from_list(filtered_stack)

    filtered_stack = [
        traceback.FrameSummary(frame.filename.replace(_CWD, "./"), frame.lineno, frame.name)
        for frame in stack
    ]
    return StackSummary.from_list(filtered_stack[-10:])


def _threads_to_diffable(threads: list[threading.Thread]) -> list[str]:
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
        result.append(f"{thread!r}@{func_fqname}{where}\n")
    return result


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


def diff(old: list[str], new: list[str]) -> Generator[str]:
    """Generate unambiguous unified diff from structured thread data."""
    matcher = difflib.SequenceMatcher(None, old, new)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        for tags, threads, prefix in [
            (("equal",), old[i1:i2], " "),
            (("delete", "replace"), old[i1:i2], "-"),
            (("insert", "replace"), new[j1:j2], "+"),
        ]:
            if tag in tags:
                for thread_str in threads:
                    for line in thread_str.splitlines():
                        yield f"{prefix} {line}\n"


@contextmanager
def assert_none():
    with threading_remembers_where():
        expected = _threads_to_diffable(threading.enumerate())
        yield
        actual = _threads_to_diffable(threading.enumerate())
        if actual != expected:
            # I really need this error to be parseable: use custom diff to
            # avoid ambiguous string-based diffs.
            raise AssertionError("\n" + "".join(diff(old=expected, new=actual)))


# -- pytest support --
def check_test(request: pytest.FixtureRequest):
    if request.node.get_closest_marker("thread_leak_allowlist"):
        yield
        return

    try:
        with assert_none():
            yield
    except AssertionError:
        scope = get_sentry_scope()
        with sentry_sdk.scope.use_scope(scope):
            scope.update_from_kwargs(
                extras={
                    "test": request.node.nodeid,
                    "test_file": request.node.fspath,
                },
            )
            scope.capture_exception()
            scope.client.flush()

        # TODO(DI-1067): strict mode:
        # raise


def allowlist(reason: str | None = None, *, issue: int):
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


def singleton_cleanup(reason: str | None = None, *, issue: int):
    decorator = pytest.mark.thread_leak_singleton_cleanup(reason=reason, issue=issue)
    return decorator
