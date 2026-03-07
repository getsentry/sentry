"""Coordinator: collects tests, partitions, spawns workers, reports results."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import pytest

from . import _DEFAULT_MAX_SLOTS

_WORKER_SCRIPT = os.path.join(os.path.dirname(__file__), "worker.py")

_OUTCOME_LABELS = {
    "passed": "PASSED",
    "failed": "FAILED",
    "skipped": "SKIPPED",
    "rerun": "RERUN",
}


class CoordinatorPlugin:
    def __init__(self, config: pytest.Config, num_workers: int) -> None:
        self.config = config
        self.num_workers = num_workers
        self._verbose = config.option.verbose > 0
        self._work_dir = Path(tempfile.mkdtemp(prefix="pytest_parallel_"))
        self._print_lock = threading.Lock()
        self._completed = 0
        self._total = 0
        self._failed = 0
        self._dots_on_line = 0
        self._dots_width = 50
        tw = config.get_terminal_writer()
        self._isatty = getattr(tw, "hasmarkup", False)

    def run(self, session: pytest.Session) -> bool:
        if not session.items:
            return True

        max_slots = self.config.hook.pytest_parallel_max_slots() or _DEFAULT_MAX_SLOTS
        n = min(self.num_workers, len(session.items), max_slots - 1)
        groups = self._partition(session.items, n)
        test_files = self._write_test_lists(groups)

        tw = session.config.get_terminal_writer()
        tw.sep("=", f"pytest-parallel: {n} workers, {len(session.items)} tests")
        for i, grp in enumerate(groups):
            files = len({it.nodeid.split("::")[0] for it in grp})
            tw.line(f"  worker {i}: {len(grp)} tests ({files} files)")
        tw.line("")

        # Let plugins do one-time setup before workers spawn.
        self.config.hook.pytest_parallel_pre_spawn(config=self.config, num_workers=n)

        self._total = len(session.items)
        items_by_nodeid: dict[str, pytest.Item] = {it.nodeid: it for it in session.items}

        active = [(i, test_files[i]) for i, grp in enumerate(groups) if grp]
        workers = self._spawn(active)
        self._monitor_and_report(workers, items_by_nodeid, session)

        session.testsfailed = self._failed
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

    def _forwarded_args(self) -> str:
        """Extract non-positional pytest args, stripping ``-n`` and test paths."""
        import shlex

        args: list[str] = []
        skip_next = False
        known = self.config.known_args_namespace
        positionals = set(getattr(known, "file_or_dir", []) or [])

        for arg in sys.argv[1:]:
            if skip_next:
                skip_next = False
                continue
            if arg in ("-n", "--numprocesses"):
                skip_next = True
                continue
            if arg.startswith(("-n", "--numprocesses=")):
                continue
            if arg in positionals:
                positionals.discard(arg)
                continue
            args.append(arg)
        return shlex.join(args)

    def _spawn(
        self, active: list[tuple[int, Path]]
    ) -> list[tuple[int, subprocess.Popen[bytes], Path]]:
        forwarded = self._forwarded_args()
        workers = []
        for i, test_file in active:
            result_path = self._work_dir / f"w{i}_results.jsonl"
            result_path.touch()
            env = os.environ.copy()
            env["PYTEST_PARALLEL_WORKER_ID"] = str(i)
            env["_PYTEST_PARALLEL_NODEIDS"] = str(test_file)
            env["_PYTEST_PARALLEL_WORKER"] = "1"
            env["_PYTEST_PARALLEL_RESULTS"] = str(result_path)
            env["_PYTEST_PARALLEL_ARGS"] = forwarded

            # Let plugins mutate the env (e.g. strip Django settings, add vars).
            self.config.hook.pytest_parallel_worker_env(env=env, worker_id=i)

            proc = subprocess.Popen(
                [sys.executable, _WORKER_SCRIPT],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
            )
            workers.append((i, proc, result_path))
        return workers

    def _progress_suffix(self) -> str:
        pct = self._completed * 100 // self._total if self._total else 0
        parts = [f"{self._completed}/{self._total} ({pct}%)"]
        if self._failed:
            parts.append(f"{self._failed} failed")
        return " ".join(parts)

    def _write_dot_progress(self, char: str, tw: pytest.TerminalWriter) -> None:
        if self._dots_on_line >= self._dots_width:
            if self._isatty:
                tw.write("\r\033[K")
            suffix = self._progress_suffix()
            tw.line(f"{'.' * self._dots_on_line}  {suffix}")
            self._dots_on_line = 0

        self._dots_on_line += 1

        if self._isatty:
            tw.write("\r\033[K")
            tw.write(f"{'.' * self._dots_on_line}  {self._progress_suffix()}")
            tw.flush()
        else:
            tw.write(char)
            tw.flush()

    def _clear_progress(self, tw: pytest.TerminalWriter) -> None:
        if self._isatty:
            tw.write("\r\033[K")
            tw.flush()

    def _redraw_progress(self, tw: pytest.TerminalWriter) -> None:
        if self._isatty:
            tw.write(f"{'.' * self._dots_on_line}  {self._progress_suffix()}")
            tw.flush()

    def _print_result(self, worker_idx: int, ev: dict, tw: pytest.TerminalWriter) -> None:
        nodeid = ev["n"]
        outcome = ev["o"]
        duration = ev.get("d", 0.0)
        label = _OUTCOME_LABELS.get(outcome, outcome.upper())
        longrepr = ev.get("r")

        with self._print_lock:
            if outcome != "rerun":
                self._completed += 1
            if outcome == "failed":
                self._failed += 1

            if self._verbose:
                if outcome == "passed":
                    tw.line(f"[w{worker_idx}] {nodeid} {label} ({duration:.2f}s)")
                elif outcome in ("skipped", "rerun"):
                    tw.line(f"[w{worker_idx}] {nodeid} {label}")
                else:
                    tw.line(f"[w{worker_idx}] {nodeid} {label} ({duration:.2f}s)", red=True)
            else:
                if outcome == "passed":
                    self._write_dot_progress(".", tw)
                elif outcome == "skipped":
                    self._write_dot_progress("s", tw)
                elif outcome == "rerun":
                    self._write_dot_progress("R", tw)
                else:
                    self._write_dot_progress("F", tw)

            if outcome == "failed" and longrepr:
                if not self._verbose:
                    self._clear_progress(tw)
                    if not self._isatty:
                        tw.line("")
                tw.line(f"FAILED {nodeid} ({duration:.2f}s)", red=True)
                for line in longrepr.splitlines():
                    tw.line(f"    {line}")
                tw.line("")
                if not self._verbose:
                    self._redraw_progress(tw)

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
        tw = session.config.get_terminal_writer()

        term_reporter = session.config.pluginmanager.get_plugin("terminalreporter")
        if term_reporter is not None:
            session.config.pluginmanager.unregister(term_reporter, "terminalreporter")

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

        reports: list[pytest.TestReport] = []
        reports_by_nodeid: dict[str, pytest.TestReport] = {}
        alive = {i for i, _, _ in workers}
        offsets: dict[int, int] = {i: 0 for i, _, _ in workers}

        def _read_results(idx: int, rpath: Path) -> None:
            try:
                with open(rpath) as f:
                    f.seek(offsets[idx])
                    for raw_line in f:
                        raw_line = raw_line.strip()
                        if not raw_line:
                            continue
                        ev = json.loads(raw_line)
                        self._print_result(idx, ev, tw)
                        item = items_by_nodeid.get(ev["n"])
                        if item is not None:
                            report = self._make_report(ev, item)
                            if ev["n"] in reports_by_nodeid:
                                old = reports_by_nodeid[ev["n"]]
                                reports[reports.index(old)] = report
                            else:
                                reports.append(report)
                            reports_by_nodeid[ev["n"]] = report
                    offsets[idx] = f.tell()
            except FileNotFoundError:
                pass

        while alive:
            for idx, proc, rpath in workers:
                if idx not in alive:
                    continue
                _read_results(idx, rpath)
                if proc.poll() is not None:
                    alive.discard(idx)
            time.sleep(0.3)

        for idx, _, rpath in workers:
            _read_results(idx, rpath)

        if not self._verbose:
            self._clear_progress(tw)
            if self._isatty:
                tw.line(f"{'.' * self._dots_on_line}  {self._progress_suffix()}")
            else:
                tw.line(f"  {self._progress_suffix()}")

        for t in threads:
            t.join(timeout=5)

        any_worker_failed = False
        for i, (idx, proc, _) in enumerate(workers):
            proc.wait()
            if proc.returncode != 0:
                any_worker_failed = True
            if proc.returncode not in (0, 1) and worker_output[i]:
                tw.line("")
                tw.sep("-", f"worker {idx} crashed (exit {proc.returncode})")
                for out_line in worker_output[i]:
                    tw.line(out_line)

        if any_worker_failed and self._failed == 0:
            self._failed = 1

        if term_reporter is not None:
            for report in reports:
                term_reporter.stats.setdefault(report.outcome, []).append(report)
            session.config.pluginmanager.register(term_reporter, "terminalreporter")

        shutil.rmtree(self._work_dir, ignore_errors=True)
