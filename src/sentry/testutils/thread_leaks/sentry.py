"""Sentry integration for reporting thread leak events with proper context."""

from __future__ import annotations

import functools
from collections.abc import Iterable
from threading import Thread
from traceback import FrameSummary
from typing import TYPE_CHECKING, Any, int

import pytest
import sentry_sdk.scope

from ._threading import get_thread_function_name
from .diff import get_relevant_frames

if TYPE_CHECKING:
    from sentry_sdk._types import Event as SentryEvent
    from sentry_sdk._types import LogLevelStr


@functools.cache
def get_scope() -> sentry_sdk.scope.Scope:
    """Create configured Sentry scope for thread leak reporting."""
    from os import environ

    sha: str | None
    branch: str | None
    if environ.get("GITHUB_ACTIONS") == "true":
        sha = environ["GITHUB_SHA"]
        branch = environ.get("GITHUB_HEAD_REF")
        repo = environ["GITHUB_REPOSITORY"]

        if not repo.startswith("getsentry/"):
            environment = "fork"
        elif branch:
            environment = "PR"
        else:
            environment = "master"
            branch = environ["GITHUB_REF_NAME"]
    else:
        sha = branch = None
        repo = "unknown"
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
        contexts={"github": {"branch": branch, "sha": sha}},
        tags={"github.repo": repo},
    )
    return scope


def capture_event(
    thread_leaks: set[Thread],
    strict: bool,
    allowlisted: pytest.Mark | None,
    item: pytest.Item,
) -> dict[str, SentryEvent]:
    """Report thread leaks to Sentry with proper event formatting."""
    # Report to Sentry
    scope = get_scope()
    events = {}
    with sentry_sdk.scope.use_scope(scope):
        for thread in thread_leaks:
            stack: Iterable[FrameSummary] = getattr(thread, "_where", [])
            event = event_from_stack(thread, stack, strict, allowlisted, item.nodeid)
            event_id = scope.capture_event(event)
            if event_id is not None:
                events[event_id] = event
        scope.client.flush()
    return events


def _mechanism_tags(mechanism_data: dict[str, Any]) -> dict[str, str]:
    from sentry.utils import json

    return {f"mechanism.{key}": json.dumps(val) for key, val in mechanism_data.items()}


def event_from_stack(
    thread: Thread,
    stack: Iterable[FrameSummary],
    strict: bool,
    allowlisted: pytest.Mark | None,
    pytest_nodeid: str,
) -> SentryEvent:
    relevant_frames = get_relevant_frames(stack)

    level: LogLevelStr
    if allowlisted:
        level = "info"
    elif strict:
        level = "error"
    else:
        level = "warning"

    pytest_file = pytest_nodeid.split("::", 1)[0]

    # Mechanism data that will be both stored and converted to tags
    # https://develop.sentry.dev/sdk/data-model/event-payloads/exception/
    mechanism_data = {
        "version": "3",
        "strict": strict,
        "allowlisted": allowlisted is not None,
    }
    exception = {
        "mechanism": {
            "type": __name__,
            "handled": not strict,
            "help_link": "https://www.notion.so/sentry/How-To-Thread-Leaks-2488b10e4b5d8049965cc057b5fb5f6b",
            "data": mechanism_data,
        },
        "type": "ThreadLeakAssertionError",
        "value": repr(thread),
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

    tags = {
        "thread.target": get_thread_function_name(thread),
        "pytest.file": pytest_file,
        **_mechanism_tags(mechanism_data),
    }
    # Add allowlisted issue if present (filter None to satisfy MutableMapping[str, str])
    if allowlisted and allowlisted.kwargs["issue"] is not None:
        tags["thread_leak_allowlist.issue"] = str(allowlisted.kwargs["issue"])

    return {
        "level": level,
        "message": "Thread leak detected",
        "exception": {"values": [exception]},
        "tags": tags,
        "contexts": {
            "pytest": {"nodeid": pytest_nodeid, "file": pytest_file},
            "thread_leak_allowlist": (
                {
                    "reason": allowlisted.kwargs["reason"],
                    "issue": allowlisted.kwargs["issue"],
                }
                if allowlisted
                else {}
            ),
        },
    }
