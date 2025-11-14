from typing import int
"""Test configuration for thread leak tests."""

from collections.abc import Generator

import pytest


@pytest.fixture(scope="package", autouse=True)
def thread_leak_test_environment() -> Generator[None]:
    """Set sentry environment to "selftest" for all tests in this package."""
    from sentry.testutils.thread_leaks.sentry import get_scope

    scope = get_scope()
    orig = scope.client.options.get("environment")
    scope.client.options["environment"] = "selftest"

    yield

    scope.client.options["environment"] = orig
