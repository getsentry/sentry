"""Sentry integration for reporting thread leak events with proper context."""

from __future__ import annotations

import functools
from collections.abc import Iterable
from threading import Thread
from traceback import FrameSummary
from typing import TYPE_CHECKING

import sentry_sdk

from .diff import get_relevant_frames

if TYPE_CHECKING:
    # this is *only* defined when TYPE_CHECKING =(
    from sentry_sdk._types import Event as SentryEvent


@functools.cache
def get_scope() -> sentry_sdk.Scope:
    """Create configured Sentry scope for thread leak reporting."""
    from os import environ

    sha: str | None
    branch: str | None
    if environ.get("GITHUB_ACTIONS") == "true":
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
        # Don't set level - scope overrides event-level
        extras={"git-branch": branch, "git-sha": sha},
    )
    return scope


def capture_event(thread_leaks: set[Thread], strict: bool) -> dict[str, SentryEvent]:
    """Report thread leaks to Sentry with proper event formatting."""
    # Report to Sentry
    scope = get_scope()
    events = {}
    with sentry_sdk.use_scope(scope):
        for thread_leak in thread_leaks:
            event = get_thread_leak_event(thread_leak, strict)
            event_id = sentry_sdk.capture_event(event)
            if event_id is not None:
                events[event_id] = event
        scope.client.flush()
    return events


def get_thread_leak_event(thread: Thread, strict: bool = True) -> SentryEvent:
    """Create Sentry event from leaked thread."""
    stack: Iterable[FrameSummary] = getattr(thread, "_where", [])
    return event_from_stack(repr(thread), stack, strict)


def event_from_stack(value: str, stack: Iterable[FrameSummary], strict: bool) -> SentryEvent:
    relevant_frames = get_relevant_frames(stack)

    # https://develop.sentry.dev/sdk/data-model/event-payloads/exception/
    exception = {
        "mechanism": {
            "type": __name__,
            "handled": not strict,
            "help_link": "https://www.notion.so/sentry/How-To-Thread-Leaks-2488b10e4b5d8049965cc057b5fb5f6b",
        },
        "type": "ThreadLeakAssertionError",
        "value": value,
        "stacktrace": {
            "frames": [
                {
                    "filename": frame.filename,
                    "function": frame.name,
                    "module": frame.locals.get("__name__") if frame.locals else None,
                    "lineno": frame.lineno,
                    "context_line": frame.line,
                    "in_app": frame in relevant_frames,
                }
                for frame in stack
            ]
        },
    }
    return {
        "level": "error" if strict else "warning",
        "message": "Thread leak detected",
        "exception": {"values": [exception]},
    }
