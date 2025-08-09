"""Pytest integration for thread leak detection."""

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


def allowlist(reason: str | None = None, *, issue: int) -> pytest.MarkDecorator:
    """Mark test as allowed to leak threads with tracking issue."""
    decorator = pytest.mark.thread_leak_allowlist(reason=reason, issue=issue)
    return decorator


def singleton_cleanup(reason: str | None = None, *, issue: int) -> pytest.MarkDecorator:
    """Mark test as needing singleton cleanup with tracking issue."""
    decorator = pytest.mark.thread_leak_singleton_cleanup(reason=reason, issue=issue)
    return decorator
