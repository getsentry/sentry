"""Temporary pytest plugin: log where each xdist worker's startup time goes.

Writes .artifacts/fixture-timings-<worker>.log with wall-clock offsets from
plugin import for session milestones, every fixture setup over 0.2s on the
first test, and higher-scoped fixtures on later tests.
"""

from __future__ import annotations

import os
import time

import pytest

_T0 = time.time()
_WORKER = os.environ.get("PYTEST_XDIST_WORKER", "main")
_PATH = os.path.join(".artifacts", f"fixture-timings-{_WORKER}.log")
_tests_seen = 0


def _log(msg: str) -> None:
    os.makedirs(".artifacts", exist_ok=True)
    with open(_PATH, "a") as f:
        f.write(f"{_WORKER} +{time.time() - _T0:7.2f}s {msg}\n")


_log("plugin imported")


def pytest_sessionstart(session):
    _log("sessionstart")


def pytest_collection_finish(session):
    _log(f"collection finished ({len(session.items)} items)")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_setup(item):
    global _tests_seen
    _tests_seen += 1
    if _tests_seen <= 2:
        _log(f"setup start #{_tests_seen} {item.nodeid}")
    start = time.time()
    yield
    if _tests_seen <= 2:
        _log(f"setup done #{_tests_seen} in {time.time() - start:.2f}s")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item):
    start = time.time()
    yield
    if _tests_seen <= 2:
        _log(f"call done #{_tests_seen} in {time.time() - start:.2f}s {item.nodeid}")


@pytest.hookimpl(hookwrapper=True)
def pytest_fixture_setup(fixturedef, request):
    start = time.time()
    yield
    took = time.time() - start
    if took > 0.2 and (_tests_seen <= 1 or fixturedef.scope != "function"):
        _log(f"fixture {fixturedef.scope}:{fixturedef.argname} {took:.2f}s")
