"""Lean parallel test execution for pytest.

Usage::

    pytest -n4 tests/

The coordinator collects tests once, partitions them, and spawns N worker
subprocesses.  Each worker runs a shim that calls ``pytest.main(nodeids)``
directly -- skipping the expensive collection walk entirely.

Workers get isolated environments via hooks.
No execnet, no dynamic load balancing, no master-worker IPC beyond temp files.
"""

from __future__ import annotations

import os

import pytest

_DEFAULT_MAX_SLOTS = 64


class ParallelHookSpec:
    @pytest.hookspec(firstresult=True)
    def pytest_parallel_max_slots(self) -> int | None:
        """Max worker slots. Default: 64."""

    @pytest.hookspec
    def pytest_parallel_pre_spawn(self, config: pytest.Config, num_workers: int) -> None:
        """Called once after collection, before workers spawn.
        For expensive one-time setup (e.g. reset shared databases)."""

    @pytest.hookspec
    def pytest_parallel_worker_env(self, env: dict[str, str], worker_id: int) -> None:
        """Mutate the env dict for a worker subprocess.
        Add/remove env vars as needed."""


def pytest_addhooks(pluginmanager: pytest.PytestPluginManager) -> None:
    pluginmanager.add_hookspecs(ParallelHookSpec)


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("parallel", "lean parallel test execution")
    group._addoption(
        "-n",
        "--numprocesses",
        type=int,
        default=0,
        dest="parallel_nprocs",
        help="Run tests across N parallel worker processes.",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_runtestloop(session: pytest.Session) -> bool | None:
    n = session.config.getoption("parallel_nprocs", default=0)
    if n <= 0 or os.environ.get("_PYTEST_PARALLEL_WORKER"):
        return None  # let the default test loop run

    from .coordinator import CoordinatorPlugin

    return CoordinatorPlugin(session.config, n).run(session)
