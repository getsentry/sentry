"""Pytest plugin for acceptance runs that record per-test coverage.

Django imports the URLconf, and with it every view module, on the first
request. Without this, each worker's first test would get the module-level
lines of all of those modules in its coverage, and selection would pick it for
almost every Python change. Importing them here, before the first test, keeps
them out of every test's coverage.
"""

import pytest


@pytest.hookimpl(trylast=True)
def pytest_sessionstart(session: pytest.Session) -> None:
    from django.core.handlers.wsgi import WSGIHandler
    from django.urls import get_resolver

    get_resolver().url_patterns
    WSGIHandler()
