"""Pytest plugin for thread leak detection."""

from collections.abc import Generator

import pytest

from .assertion import assert_none


def check_test(request: pytest.FixtureRequest, strict: bool = True) -> Generator[None]:
    """Check test for thread leaks, respecting allowlist markers."""
    if request.node.get_closest_marker("thread_leak_allowlist"):
        yield
    else:
        with assert_none(strict):
            yield


def thread_leak_allowlist(reason: str | None = None, *, issue: int) -> pytest.MarkDecorator:
    """Mark test as allowed to leak threads with tracking issue."""
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: pytest.Item) -> Generator[None]:
    """Wrap the test call phase with thread leak detection."""
    if item.get_closest_marker("thread_leak_allowlist"):
        yield
        return

    # Set pytest context on thread leak Sentry scope
    from .sentry import get_scope

    scope = get_scope()
    scope.set_tag("pytest.file", item.nodeid.split("::", 1)[0])
    scope.set_extra("pytest.nodeid", item.nodeid)

    # TODO(DI-1067): strict mode
    with assert_none(strict=False):
        yield
