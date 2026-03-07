"""Worker shim for pytest-parallel.

Spawned as a subprocess by the coordinator.  Reads nodeids from a file
and calls ``pytest.main()`` directly -- skipping the expensive collection
walk that would happen if the worker received directory paths.

Expected env vars (set by the coordinator):
    _PYTEST_PARALLEL_NODEIDS   Path to a file containing one nodeid per line.
    _PYTEST_PARALLEL_RESULTS   Path to a JSONL file for structured results.
    _PYTEST_PARALLEL_ARGS      Shell-quoted non-positional pytest args to forward.
    PYTEST_PARALLEL_WORKER_ID  Worker slot number for isolation.
"""

from __future__ import annotations

import json
import os
import shlex
import sys

# When run as a script, Python prepends the script's directory to sys.path.
# That would shadow the real pytest package.  Remove it.
_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path[:] = [p for p in sys.path if os.path.abspath(p) != _script_dir]

import pytest


class _ResultReporter:
    """Pytest plugin that writes one JSON line per test outcome."""

    def __init__(self, results_path: str) -> None:
        self._path = results_path

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        if not self._path:
            return
        if report.when == "call" or (report.when == "setup" and report.failed):
            with open(self._path, "a") as fh:
                fh.write(
                    json.dumps(
                        {
                            "n": report.nodeid,
                            "o": report.outcome,
                            "d": round(report.duration, 3),
                            "r": str(report.longrepr) if report.longrepr else None,
                        }
                    )
                    + "\n"
                )


def main() -> None:
    nodeids_file = os.environ["_PYTEST_PARALLEL_NODEIDS"]
    with open(nodeids_file) as f:
        nodeids = [line.strip() for line in f if line.strip()]

    extra_args = shlex.split(os.environ.get("_PYTEST_PARALLEL_ARGS", ""))
    results_path = os.environ.get("_PYTEST_PARALLEL_RESULTS", "")

    args = extra_args + nodeids
    plugin = _ResultReporter(results_path)
    sys.exit(pytest.main(args, plugins=[plugin]))


if __name__ == "__main__":
    main()
