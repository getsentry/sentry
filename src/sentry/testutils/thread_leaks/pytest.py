"""Pytest plugin for thread leak detection."""

from collections.abc import Generator
from os import environ
from threading import Thread
from typing import int, Any

import pytest

from . import sentry
from ._threading import get_thread_function_name
from .assertion import ThreadLeakAssertionError, assert_none


def thread_leak_allowlist(reason: str | None = None, *, issue: int) -> pytest.MarkDecorator:
    """Mark test as allowed to leak threads with tracking issue."""
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


# TODO(DI-1067): strict mode by default
STRICT = environ.get("SENTRY_THREAD_LEAK_STRICT", "") == "1"

del environ  # hygiene


# TODO(DI-1282): ignoring all leaks involving this thread, issue is too widespread to use allowlist marks.
# actual fix must be implemented. see issue #98988
def filter_django_dev_server_threads(threads: set[Thread]) -> set[Thread]:
    return {
        thread
        for thread in threads
        if get_thread_function_name(thread)
        != "django.core.servers.basehttp.ThreadedWSGIServer.process_request_thread"
    }


@pytest.hookimpl(wrapper=True)
def pytest_runtest_call(item: pytest.Item) -> Generator[dict[str, Any]]:
    """Wrap the test call phase with thread leak detection."""
    result: dict[str, Any] = {"events": {}}
    try:
        with assert_none():
            yield result
    except ThreadLeakAssertionError as error:
        allowlisted = item.get_closest_marker("thread_leak_allowlist")

        filtered_thread_leaks = filter_django_dev_server_threads(error.thread_leaks)

        if filtered_thread_leaks:
            result["events"] = sentry.capture_event(
                filtered_thread_leaks, STRICT, allowlisted, item
            )

        if STRICT and not allowlisted and filtered_thread_leaks:
            raise
