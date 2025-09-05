"""Pytest plugin for thread leak detection."""

from collections.abc import Generator
from os import environ
from typing import Any

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


@pytest.hookimpl(wrapper=True)
def pytest_runtest_call(item: pytest.Item) -> Generator[dict[str, Any]]:
    """Wrap the test call phase with thread leak detection."""
    result: dict[str, Any] = {"events": {}}
    try:
        with assert_none():
            yield result
    except ThreadLeakAssertionError as error:
        allowlisted = item.get_closest_marker("thread_leak_allowlist")

        # TODO(DI-1282): ignoring all leaks involving this thread, issue is too widespread to use allowlist marks.
        # actual fix must be implemented. see issue #98988
        is_dev_server_thread_leak = any(
            get_thread_function_name(thread)
            == "django.core.servers.basehttp.ThreadedWSGIServer.process_request_thread"
            for thread in error.thread_leaks
        )
        if is_dev_server_thread_leak:
            return result

        result["events"] = sentry.capture_event(error.thread_leaks, STRICT, allowlisted, item)

        if STRICT and not allowlisted:
            raise
