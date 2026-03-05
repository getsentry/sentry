"""Lean parallel test execution for Sentry.

Usage::

    pytest -n4 tests/sentry/foo/

Distributes all collected tests upfront across N worker subprocesses.
Each worker gets isolated databases, Redis, and Kafka via the xdist module.

No execnet, no dynamic load balancing, no master-worker IPC beyond temp files.
Workers are plain ``pytest`` processes with ``SENTRY_TEST_WORKER_ID`` and
``_SENTRY_PARALLEL_NODEIDS`` set.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import textwrap
import threading
import time
from pathlib import Path

import pytest

from sentry.testutils.pytest.xdist import _MAX_SLOTS

# Tiny plugin injected into workers for structured result reporting.
# Writes one JSON line per test to a temp file the coordinator polls.
_WORKER_REPORTER = textwrap.dedent("""\
    import json, os
    _f = os.environ.get("_SENTRY_PARALLEL_RESULTS", "")
    def pytest_runtest_logreport(report):
        if _f and (report.when == "call" or (report.when == "setup" and report.failed)):
            with open(_f, "a") as fh:
                fh.write(json.dumps({
                    "n": report.nodeid, "o": report.outcome, "d": round(report.duration, 3),
                    "r": str(report.longrepr) if report.longrepr else None,
                }) + "\\n")
""")


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("parallel", "lean parallel test execution")
    # _addoption bypasses the lowercase short-option reservation that pytest
    # enforces on third-party plugins (shortupper=True internally).
    group._addoption(
        "-n",
        "--numprocesses",
        type=int,
        default=0,
        dest="sentry_parallel",
        help="Run tests across N parallel worker processes.",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_runtestloop(session: pytest.Session) -> bool | None:
    n = session.config.getoption("sentry_parallel", default=0)
    if n <= 0 or os.environ.get("_SENTRY_PARALLEL_WORKER"):
        return None  # let the default test loop run
    return _CoordinatorPlugin(session.config, n).run(session)


_OUTCOME_LABELS = {
    "passed": "PASSED",
    "failed": "FAILED",
    "skipped": "SKIPPED",
}


class _CoordinatorPlugin:
    def __init__(self, config: pytest.Config, num_workers: int) -> None:
        self.config = config
        self.num_workers = num_workers
        self._work_dir = Path(tempfile.mkdtemp(prefix="sentry_parallel_"))
        self._reporter_path = self._work_dir / "_reporter.py"
        self._reporter_path.write_text(_WORKER_REPORTER)
        self._print_lock = threading.Lock()

    def run(self, session: pytest.Session) -> bool:
        if not session.items:
            return True

        n = min(self.num_workers, len(session.items), _MAX_SLOTS - 1)
        groups = self._partition(session.items, n)
        test_files = self._write_test_lists(groups)

        tw = session.config.get_terminal_writer()
        tw.sep("=", f"sentry-parallel: {n} workers, {len(session.items)} tests")
        for i, grp in enumerate(groups):
            files = len({it.nodeid.split("::")[0] for it in grp})
            tw.line(f"  worker {i}: {len(grp)} tests ({files} files)")
        tw.line("")

        items_by_nodeid: dict[str, pytest.Item] = {it.nodeid: it for it in session.items}

        active = [(i, test_files[i]) for i, grp in enumerate(groups) if grp]
        workers = self._spawn(active)
        self._monitor_and_report(workers, items_by_nodeid, session)
        return True

    # -- internals ------------------------------------------------------------

    @staticmethod
    def _partition(items: list[pytest.Item], n: int) -> list[list[pytest.Item]]:
        """Split items into *n* groups by round-robining files.

        Preserves the original collection order: files are assigned to
        workers in the order they appear, cycling through workers. Tests
        within each file keep their original ordering.
        """
        by_file: dict[str, list[pytest.Item]] = {}
        file_order: list[str] = []
        for item in items:
            key = item.nodeid.split("::")[0]
            if key not in by_file:
                by_file[key] = []
                file_order.append(key)
            by_file[key].append(item)

        buckets: list[list[pytest.Item]] = [[] for _ in range(n)]
        for i, key in enumerate(file_order):
            buckets[i % n].extend(by_file[key])
        return buckets

    def _write_test_lists(self, groups: list[list[pytest.Item]]) -> list[Path]:
        paths = []
        for i, items in enumerate(groups):
            nodeids = [item.nodeid for item in items]
            p = self._work_dir / f"w{i}_tests.txt"
            p.write_text("\n".join(nodeids) + "\n")
            paths.append(p)
        return paths

    def _worker_args(self) -> list[str]:
        """Reconstruct pytest CLI args, stripping ``-n``/``--numprocesses``."""
        args = [sys.executable, "-m", "pytest"]
        skip_next = False
        for arg in sys.argv[1:]:
            if skip_next:
                skip_next = False
                continue
            if arg in ("-n", "--numprocesses"):
                skip_next = True
                continue
            if arg.startswith(("-n", "--numprocesses=")):
                continue
            args.append(arg)
        # Inject our worker-side reporter plugin.
        args.extend(["-p", "_reporter"])
        return args

    def _spawn(
        self, active: list[tuple[int, Path]]
    ) -> list[tuple[int, subprocess.Popen[bytes], Path]]:
        base_args = self._worker_args()
        workers = []
        for i, test_file in active:
            result_path = self._work_dir / f"w{i}_results.jsonl"
            result_path.touch()
            env = os.environ.copy()
            env["SENTRY_TEST_WORKER_ID"] = str(i)
            env["_SENTRY_PARALLEL_NODEIDS"] = str(test_file)
            env["_SENTRY_PARALLEL_WORKER"] = "1"
            env["_SENTRY_PARALLEL_RESULTS"] = str(result_path)
            # Ensure the reporter plugin is importable.
            env["PYTHONPATH"] = str(self._work_dir) + os.pathsep + env.get("PYTHONPATH", "")
            # Don't let workers inherit stale identity or pre-configured Django.
            env.pop("SENTRY_PYTEST_SERIAL", None)
            env.pop("DJANGO_SETTINGS_MODULE", None)

            proc = subprocess.Popen(
                base_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
            )
            workers.append((i, proc, result_path))
        return workers

    def _print_result(self, worker_idx: int, ev: dict, tw: pytest.TerminalWriter) -> None:
        """Print a test result line, holding the lock so output doesn't interleave."""
        nodeid = ev["n"]
        outcome = ev["o"]
        duration = ev.get("d", 0.0)
        label = _OUTCOME_LABELS.get(outcome, outcome.upper())
        longrepr = ev.get("r")

        with self._print_lock:
            if outcome == "passed":
                tw.line(f"[w{worker_idx}] {nodeid} {label} ({duration:.2f}s)")
            elif outcome == "skipped":
                tw.line(f"[w{worker_idx}] {nodeid} {label}")
            else:
                tw.line(f"[w{worker_idx}] {nodeid} {label} ({duration:.2f}s)", red=True)
                if longrepr:
                    tw.line("")
                    for line in longrepr.splitlines():
                        tw.line(f"    {line}")
                    tw.line("")

    @staticmethod
    def _make_report(ev: dict, item: pytest.Item) -> pytest.TestReport:
        return pytest.TestReport(
            nodeid=ev["n"],
            location=item.location,
            keywords={},
            outcome=ev["o"],
            longrepr=ev.get("r"),
            when="call",
            duration=ev.get("d", 0.0),
        )

    def _monitor_and_report(
        self,
        workers: list[tuple[int, subprocess.Popen[bytes], Path]],
        items_by_nodeid: dict[str, pytest.Item],
        session: pytest.Session,
    ) -> None:
        from sentry.utils import json

        tw = session.config.get_terminal_writer()

        # Unregister the terminal reporter during test execution so it doesn't
        # print dots/lines. We feed stats manually and re-register for summary.
        term_reporter = session.config.pluginmanager.get_plugin("terminalreporter")
        if term_reporter is not None:
            session.config.pluginmanager.unregister(term_reporter, "terminalreporter")

        # Drain stdout in background threads so pipes don't block.
        worker_output: list[list[str]] = [[] for _ in range(len(workers))]

        def _drain(idx: int, proc: subprocess.Popen[bytes]) -> None:
            assert proc.stdout is not None
            for raw in proc.stdout:
                worker_output[idx].append(raw.decode("utf-8", errors="replace").rstrip())

        threads = []
        for idx, proc, _ in workers:
            t = threading.Thread(target=_drain, args=(idx, proc), daemon=True)
            t.start()
            threads.append(t)

        # Poll result files, print our output, and collect reports for pytest.
        reports: list[pytest.TestReport] = []
        alive = {i for i, _, _ in workers}
        offsets = {i: 0 for i, _, _ in workers}
        while alive:
            for idx, proc, rpath in workers:
                if idx not in alive:
                    continue
                try:
                    with open(rpath) as f:
                        f.seek(offsets[idx])
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            ev = json.loads(line)
                            self._print_result(idx, ev, tw)
                            item = items_by_nodeid.get(ev["n"])
                            if item is not None:
                                reports.append(self._make_report(ev, item))
                        offsets[idx] = f.tell()
                except FileNotFoundError:
                    pass

                if proc.poll() is not None:
                    alive.discard(idx)

            time.sleep(0.3)

        for t in threads:
            t.join(timeout=5)
        for _, proc, _ in workers:
            proc.wait()

        # Feed collected reports into the terminal reporter's stats so the
        # summary line is correct, then re-register it for summary output.
        if term_reporter is not None:
            for report in reports:
                term_reporter.stats.setdefault(report.outcome, []).append(report)
            session.config.pluginmanager.register(term_reporter, "terminalreporter")
