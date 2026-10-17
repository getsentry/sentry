from __future__ import annotations

import json
import os
import sys
import time
import warnings
from collections.abc import Generator, Sequence
from contextlib import contextmanager, redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any

import pytest

from .manifest import MANIFEST_ENV, Manifest, ManifestError, arrange_assigned, ignores_collection, load_manifest

_PROTOCOL_VERSION = 1


class ResultReporter:
    def __init__(
        self,
        results_path: str,
        *,
        expected_nodeids: Sequence[str] | None = None,
        stop_path: Path | None = None,
        output_path: Path | None = None,
        ramp_delay: float = 0.0,
        manifest_path: str | None = None,
    ) -> None:
        self.results_path = results_path
        self.expected_nodeids = list(expected_nodeids) if expected_nodeids is not None else None
        self.stop_path = stop_path
        self.output_path = output_path
        self.ramp_delay = ramp_delay
        self.manifest_path = manifest_path
        self.manifest: Manifest | None = None
        self.config: pytest.Config | None = None
        self.session: pytest.Session | None = None
        self._capture_mode = "fd"
        self._collection_finished = False
        self._ramp_applied = False
        self._uncaptured_chunks: list[str] = []
        self._expected_index = 0
        self._pending_retry: tuple[str, int] | None = None
        self._rerunning: set[str] = set()
        self._active_attempt: tuple[str, int] | None = None
        self._last_finished_attempt: tuple[str, int] | None = None

    def _emit(self, payload: dict[str, Any]) -> None:
        if not self.results_path:
            return
        record = {"version": _PROTOCOL_VERSION, **payload}
        line = json.dumps(record, default=repr) + "\n"
        with open(self.results_path, "a", encoding="utf-8") as result_file:
            result_file.write(line)
            result_file.flush()

    def _should_stop(self) -> bool:
        return self.stop_path is not None and self.stop_path.exists()

    def _wait_for_ramp(self) -> bool:
        if self.ramp_delay <= 0.0:
            return False
        deadline = time.monotonic() + self.ramp_delay
        while True:
            if self._should_stop():
                return True
            remaining = deadline - time.monotonic()
            if remaining <= 0.0:
                return False
            time.sleep(min(0.02, remaining))

    @contextmanager
    def _record_uncaptured_phase_output(self) -> IteratorOrGenerator:
        if self._capture_mode != "no" or self.output_path is None:
            yield
            return
        sys.stdout.flush()
        sys.stderr.flush()
        try:
            start_offset = self.output_path.stat().st_size
        except OSError:
            start_offset = 0
        try:
            yield
        finally:
            sys.stdout.flush()
            sys.stderr.flush()
            try:
                with self.output_path.open("rb") as handle:
                    handle.seek(start_offset)
                    chunk = handle.read().decode("utf-8", errors="replace")
                if chunk:
                    self._uncaptured_chunks.append(chunk)
            except OSError:
                pass

    def pytest_configure(self, config: pytest.Config) -> None:
        self.config = config
        self._capture_mode = str(config.getoption("capture", default="fd"))
        if self.manifest_path is None:
            return
        try:
            self.manifest = load_manifest(Path(self.manifest_path))
        except ManifestError as exc:
            raise pytest.UsageError(str(exc)) from exc

    @pytest.hookimpl(tryfirst=True)
    def pytest_ignore_collect(self, collection_path: Path, config: pytest.Config) -> bool | None:
        manifest = self.manifest
        if manifest is None:
            return None
        root = config.rootpath if isinstance(config.rootpath, Path) else Path(str(config.rootpath))
        if ignores_collection(collection_path, root, manifest.files):
            return True
        return None

    def pytest_collectreport(self, report: pytest.CollectReport) -> None:
        if report.passed:
            return
        serialized = self._serialize_report(report)
        self._emit(
            {
                "type": "collect_report",
                "nodeid": report.nodeid,
                "outcome": report.outcome,
                "longrepr": str(report.longrepr) if report.longrepr else None,
                "report": serialized,
            }
        )

    def pytest_sessionstart(self, session: pytest.Session) -> None:
        self.session = session

    @pytest.hookimpl(trylast=True)
    def pytest_collection_finish(self, session: pytest.Session) -> None:
        self.session = session
        self._collection_finished = True
        if self.manifest is not None:
            try:
                arranged = arrange_assigned(session.items, self.manifest)
            except ManifestError as exc:
                session.items.clear()
                raise session.Interrupted(str(exc)) from exc
            session.items[:] = arranged
        collected = [item.nodeid for item in session.items]
        self._emit({"type": "collection", "nodeids": collected})
        if self.expected_nodeids is not None and collected != self.expected_nodeids:
            session.items.clear()
            raise session.Interrupted("worker collection mismatch")

    @pytest.hookimpl(tryfirst=True)
    def pytest_runtest_protocol(self, item: pytest.Item, nextitem: pytest.Item | None) -> bool | None:
        if self._should_stop():
            item.session.shouldstop = "stopped by coordinator"
            return True
        if not self._ramp_applied:
            self._ramp_applied = True
            if self._wait_for_ramp():
                item.session.shouldstop = "stopped by coordinator"
                return True
        return None

    def pytest_runtest_logstart(self, nodeid: str, location: tuple[str, int | None, str]) -> None:
        if self._active_attempt is not None:
            raise RuntimeError(f"test {self._active_attempt[0]!r} has not finished its attempt")
        self._uncaptured_chunks.clear()
        if self._pending_retry is not None:
            retry_nodeid, previous_attempt = self._pending_retry
            if retry_nodeid != nodeid:
                raise RuntimeError(f"retry for {retry_nodeid!r} was followed by {nodeid!r}")
            attempt = previous_attempt + 1
            self._pending_retry = None
        else:
            if self.expected_nodeids is not None:
                if self._expected_index >= len(self.expected_nodeids):
                    raise RuntimeError(f"unexpected test start for {nodeid!r}")
                expected_nodeid = self.expected_nodeids[self._expected_index]
                if expected_nodeid != nodeid:
                    raise RuntimeError(f"expected test start for {expected_nodeid!r}, got {nodeid!r}")
            attempt = 1
        self._rerunning.discard(nodeid)
        self._active_attempt = (nodeid, attempt)
        self._emit(
            {
                "type": "test_start",
                "nodeid": nodeid,
                "attempt": attempt,
                "location": [location[0], location[1], location[2]],
            }
        )

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_setup(self, item: pytest.Item) -> Generator[None]:
        with self._record_uncaptured_phase_output():
            yield

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_call(self, item: pytest.Item) -> Generator[None]:
        with self._record_uncaptured_phase_output():
            yield

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_teardown(self, item: pytest.Item, nextitem: pytest.Item | None) -> Generator[None]:
        with self._record_uncaptured_phase_output():
            yield

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        serialized = self._serialize_report(report)
        if self._active_attempt is None or self._active_attempt[0] != report.nodeid:
            raise RuntimeError(f"report for {report.nodeid!r} without an active attempt")
        attempt = self._active_attempt[1]
        if report.outcome == "rerun":
            self._rerunning.add(report.nodeid)
        self._emit(
            {
                "type": "report",
                "nodeid": report.nodeid,
                "attempt": attempt,
                "when": report.when,
                "outcome": report.outcome,
                "duration": float(report.duration),
                "longrepr": str(report.longrepr) if report.longrepr else None,
                "wasxfail": getattr(report, "wasxfail", None),
                "report": serialized,
            }
        )

    def pytest_runtest_logfinish(self, nodeid: str, location: tuple[str, int | None, str]) -> None:
        if self._active_attempt is None or self._active_attempt[0] != nodeid:
            raise RuntimeError(f"test finish for {nodeid!r} without an active attempt")
        stdout = "".join(self._uncaptured_chunks)
        self._uncaptured_chunks.clear()
        attempt = self._active_attempt[1]
        final = nodeid not in self._rerunning
        payload: dict[str, Any] = {
            "type": "test_finish",
            "nodeid": nodeid,
            "attempt": attempt,
            "final": final,
            "location": [location[0], location[1], location[2]],
        }
        if final and self.expected_nodeids is not None:
            if self._expected_index >= len(self.expected_nodeids):
                raise RuntimeError(f"unexpected test finish for {nodeid!r}")
            expected_nodeid = self.expected_nodeids[self._expected_index]
            if expected_nodeid != nodeid:
                raise RuntimeError(f"expected test finish for {expected_nodeid!r}, got {nodeid!r}")
        if stdout:
            payload["stdout"] = stdout
        self._emit(payload)
        self._active_attempt = None
        self._last_finished_attempt = (nodeid, attempt)
        if final:
            if self.expected_nodeids is not None:
                self._expected_index += 1
        else:
            self._pending_retry = (nodeid, attempt)
        if self._should_stop() and self.session is not None:
            self.session.shouldstop = "stopped by coordinator"
            if not final:
                raise self.session.Interrupted(self.session.shouldstop)

    def pytest_warning_recorded(
        self,
        warning_message: warnings.WarningMessage,
        when: str,
        nodeid: str,
        location: tuple[str, int, str] | None,
    ) -> None:
        if when != "runtest":
            return
        active_attempt = self._active_attempt
        if active_attempt is not None and active_attempt[0] == nodeid:
            attempt = active_attempt[1]
        elif self._last_finished_attempt is not None and self._last_finished_attempt[0] == nodeid:
            attempt = self._last_finished_attempt[1]
        else:
            raise RuntimeError(f"runtest warning for {nodeid!r} without a matching test attempt")
        self._emit(
            {
                "type": "warning",
                "attempt": attempt,
                "message": str(warning_message.message),
                "category_module": warning_message.category.__module__,
                "category_name": warning_message.category.__qualname__,
                "filename": warning_message.filename,
                "lineno": int(warning_message.lineno),
                "line": warning_message.line,
                "when": when,
                "nodeid": nodeid,
                "location": list(location) if location is not None else None,
            }
        )

    def pytest_internalerror(self, excrepr: Any) -> None:
        self._emit(
            {
                "type": "internal_error",
                "excrepr": str(excrepr),
            }
        )

    def pytest_sessionfinish(self, session: pytest.Session, exitstatus: int | pytest.ExitCode) -> None:
        self._emit(
            {
                "type": "session_finish",
                "exitstatus": int(exitstatus),
                "shouldstop": str(session.shouldstop) if session.shouldstop else None,
                "shouldfail": str(session.shouldfail) if session.shouldfail else None,
            }
        )

    def _serialize_report(self, report: pytest.TestReport | pytest.CollectReport) -> dict[str, Any]:
        if self.config is not None:
            data = self.config.hook.pytest_report_to_serializable(config=self.config, report=report)
            if isinstance(data, dict):
                extra = getattr(report, "_json_report_extra", None)
                if isinstance(extra, dict):
                    data["_json_report_extra"] = extra
                return data
        data = report._to_json()
        extra = getattr(report, "_json_report_extra", None)
        if isinstance(extra, dict):
            data["_json_report_extra"] = extra
        data["$report_type"] = report.__class__.__name__
        return data


IteratorOrGenerator = Generator[None]


def run_worker(
    env: dict[str, str],
    nodeids: list[str],
    forwarded_args: list[str],
    rootdir: str,
    results_path: Path,
    output_path: Path,
) -> None:
    worker_env = dict(env)
    raw_ramp = worker_env.pop("_PYTEST_PARALLEL_RAMP_DELAY", "0")
    try:
        ramp_delay = float(raw_ramp)
    except ValueError:
        ramp_delay = 0.0
    os.environ.clear()
    os.environ.update(worker_env)
    os.environ["_PYTEST_PARALLEL_WORKER_ENTRY"] = "1"
    stop_path = results_path.parent / "stop"
    rootdir_args = [f"--rootdir={rootdir}"] if rootdir else []
    manifest_path = worker_env.get(MANIFEST_ENV)
    if manifest_path:
        args = [*rootdir_args, *forwarded_args]
    else:
        args = [*rootdir_args, *forwarded_args, *_absolute_nodeids(rootdir, nodeids)]
    reporter = ResultReporter(
        str(results_path),
        expected_nodeids=nodeids,
        stop_path=stop_path,
        output_path=output_path,
        ramp_delay=ramp_delay,
        manifest_path=manifest_path,
    )
    with output_path.open("a", encoding="utf-8") as output_file, redirect_stdout(output_file), redirect_stderr(output_file):
        saved_fds: list[int] = []
        try:
            for fd in (1, 2):
                try:
                    saved_fds.append(os.dup(fd))
                    os.dup2(output_file.fileno(), fd)
                except OSError:
                    pass
            exit_code = pytest.main(args, plugins=[reporter])
        finally:
            try:
                sys.stdout.flush()
            except Exception:
                pass
            try:
                sys.stderr.flush()
            except Exception:
                pass
            output_file.flush()
            for fd, saved in zip((1, 2), saved_fds, strict=False):
                try:
                    os.dup2(saved, fd)
                    os.close(saved)
                except OSError:
                    pass
        sys.exit(int(exit_code))


def _absolute_nodeids(rootdir: str, nodeids: list[str]) -> list[str]:
    if not rootdir:
        return nodeids

    root = Path(rootdir)
    absolute = []
    for nodeid in nodeids:
        file_name, sep, rest = nodeid.partition("::")
        path = Path(file_name)
        if not path.is_absolute():
            path = root / path
        absolute.append(f"{path}{sep}{rest}" if sep else str(path))
    return absolute
