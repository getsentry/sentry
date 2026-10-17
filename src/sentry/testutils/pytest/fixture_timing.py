"""Opt-in per-fixture and per-phase timing.

Enable with `-p sentry.testutils.pytest.fixture_timing` and set
`SENTRY_FIXTURE_TIMING_OUT=/path/prefix`. Each process (xdist controller and
workers) writes `<prefix>.<worker>.json` with:

- setup/teardown: fixture key -> [count, seconds] (self time, excludes
  dependent fixtures, which are resolved before pytest_fixture_setup runs)
- phase: session-level wall time buckets
"""

from __future__ import annotations

import collections
import json
import os
import time
from collections.abc import Generator
from typing import Any

import pytest

_setup: collections.defaultdict[str, list[float]] = collections.defaultdict(lambda: [0, 0.0])
_teardown: collections.defaultdict[str, list[float]] = collections.defaultdict(lambda: [0, 0.0])
_phase: dict[str, float] = {}
_t0 = time.perf_counter()


def _key(fixturedef: pytest.FixtureDef[Any]) -> str:
    return f"{fixturedef.argname}|{fixturedef.scope}|{fixturedef.baseid or '<plugin>'}"


@pytest.hookimpl(wrapper=True)
def pytest_fixture_setup(
    fixturedef: pytest.FixtureDef[Any], request: pytest.FixtureRequest
) -> Generator[None, Any, Any]:
    key = _key(fixturedef)
    started: list[float] = []

    def _end_teardown() -> None:
        if started:
            r = _teardown[key]
            r[0] += 1
            r[1] += time.perf_counter() - started.pop()

    # Finalizers run LIFO: this one runs after the fixture's own teardown...
    fixturedef.addfinalizer(_end_teardown)
    t = time.perf_counter()
    try:
        return (yield)
    finally:
        r = _setup[key]
        r[0] += 1
        r[1] += time.perf_counter() - t
        # ...and this one runs before it.
        fixturedef.addfinalizer(lambda: started.append(time.perf_counter()))


@pytest.hookimpl(wrapper=True)
def pytest_collection(session: pytest.Session) -> Generator[None, Any, Any]:
    _phase["startup_before_collection"] = time.perf_counter() - _t0
    t = time.perf_counter()
    try:
        return (yield)
    finally:
        _phase["collection"] = time.perf_counter() - t


_first_test: list[float] = []


def pytest_runtest_logstart(nodeid: str, location: Any) -> None:
    if not _first_test:
        _first_test.append(time.perf_counter())
        _phase["until_first_test"] = _first_test[0] - _t0


# trylast: after the runner tears down session-scoped fixtures.
@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if _first_test:
        _phase["tests"] = time.perf_counter() - _first_test[0]
    out = os.environ.get("SENTRY_FIXTURE_TIMING_OUT")
    if not out:
        return
    _phase["total"] = time.perf_counter() - _t0
    worker = os.environ.get("PYTEST_XDIST_WORKER", "main")
    with open(f"{out}.{worker}.json", "w") as f:
        json.dump({"setup": dict(_setup), "teardown": dict(_teardown), "phase": _phase}, f)

