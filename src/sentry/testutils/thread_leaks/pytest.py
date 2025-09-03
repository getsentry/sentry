"""Pytest plugin for thread leak detection."""

from collections.abc import Generator

import pytest

from .assertion import assert_none


def thread_leak_allowlist(reason: str | None = None, *, issue: int) -> pytest.MarkDecorator:
    """Mark test as allowed to leak threads with tracking issue."""
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: pytest.Item) -> Generator[None]:
    """Wrap the test call phase with thread leak detection."""

    # Set pytest context on thread leak Sentry scope
    from .sentry import get_scope

    scope = get_scope()
    scope.set_tag("pytest.file", item.nodeid.split("::", 1)[0])
    scope.set_extra("pytest.nodeid", item.nodeid)

    allowlisted = item.get_closest_marker("thread_leak_allowlist")
    if allowlisted:
        scope.set_tag("thread_leak_allowlist.issue", allowlisted.kwargs["issue"])
        scope.set_extra("thread_leak_allowlist.reason", allowlisted.kwargs["reason"])

    # TODO(DI-1067): strict mode
    with assert_none(strict=False, allowlisted=allowlisted is not None):
        yield
