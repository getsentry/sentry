from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast
from unittest.mock import Mock

import pytest
from _pytest.main import Session
from _pytest.subtests import SubtestContext

from pytest_parallel.coordinator import Coordinator, WorkerState
from pytest_parallel.worker import ResultReporter


def _report(nodeid: str, when: str, outcome: str, attempt: int) -> dict[str, Any]:
    report = cast(
        Any,
        pytest.TestReport(
            nodeid=nodeid,
            location=("test_retry.py", 1, nodeid),
            keywords={},
            outcome=cast(Any, outcome),
            longrepr="retry failed" if outcome in {"failed", "rerun"} else None,
            when=cast(Any, when),
            duration=0.01,
        ),
    )
    report._json_report_extra = {when: {"stdout": f"attempt {attempt}"}}
    return {
        "version": 1,
        "type": "report",
        "nodeid": nodeid,
        "attempt": attempt,
        "when": when,
        "outcome": outcome,
        "duration": report.duration,
        "report": report._to_json(),
    }


def _harness(tmp_path: Path) -> tuple[Coordinator, WorkerState, Any, dict[str, Any]]:
    nodeid = "test_retry.py::test_retry"
    config = Mock()
    config.option.setuponly = False
    for hook_name in (
        "pytest_runtest_logstart",
        "pytest_runtest_logreport",
        "pytest_runtest_logfinish",
        "pytest_collectreport",
    ):
        setattr(config.hook, hook_name, Mock())
    config.hook.pytest_warning_recorded.call_historic = Mock()
    config.hook.pytest_report_from_serializable = Mock(return_value=None)

    session = Mock()
    session.config = config
    session.testsfailed = 0
    session.shouldfail = False
    session.shouldstop = False

    process = Mock()
    process.exitcode = 0
    process.is_alive.return_value = False
    result_path = tmp_path / "worker_results.jsonl"
    output_path = tmp_path / "worker_output.txt"
    result_path.touch()
    output_path.touch()
    state = WorkerState(
        worker_id=0,
        process=process,
        result_path=result_path,
        output_path=output_path,
        assigned=[nodeid],
    )
    item = Mock()
    item.nodeid = nodeid
    item.location = ("test_retry.py", 1, nodeid)
    coordinator = Coordinator(cast(Any, config), 1)
    coordinator._work_dir = tmp_path
    return coordinator, state, session, {nodeid: item}


def _read_events(state: WorkerState, events: list[dict[str, Any]]) -> None:
    state.result_path.write_text(
        "".join(json.dumps(event) + "\n" for event in events), encoding="utf-8"
    )


def test_retry_attempts_replay_reports_and_complete_once(tmp_path: Path) -> None:
    coordinator, state, session, items = _harness(tmp_path)
    nodeid = state.assigned[0]
    events = [
        {"version": 1, "type": "collection", "nodeids": [nodeid]},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 1},
        _report(nodeid, "setup", "passed", 1),
        _report(nodeid, "call", "rerun", 1),
        {"version": 1, "type": "test_finish", "nodeid": nodeid, "attempt": 1, "final": False},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 2},
        _report(nodeid, "setup", "passed", 2),
        _report(nodeid, "call", "passed", 2),
        _report(nodeid, "teardown", "passed", 2),
        {"version": 1, "type": "test_finish", "nodeid": nodeid, "attempt": 2, "final": True},
        {"version": 1, "type": "session_finish", "exitstatus": 0},
    ]
    _read_events(state, events)

    coordinator._read_worker_events(state, items, session, Mock(), final=True)

    assert state.protocol_errors == []
    assert state.started == [nodeid]
    assert state.completed == [nodeid]
    assert coordinator._completed == 1
    assert [call.kwargs["report"].outcome for call in config_report_calls(session)] == [
        "passed",
        "rerun",
        "passed",
        "passed",
        "passed",
    ]
    assert session.config.hook.pytest_runtest_logstart.call_count == 2
    assert session.config.hook.pytest_runtest_logfinish.call_count == 2


def test_subtest_reports_can_arrive_before_phase_reports(tmp_path: Path) -> None:
    coordinator, state, session, items = _harness(tmp_path)
    nodeid = state.assigned[0]

    def subtest_report(index: int) -> dict[str, Any]:
        report = pytest.SubtestReport(
            nodeid=nodeid,
            location=("test_retry.py", 1, nodeid),
            keywords={},
            outcome="passed",
            longrepr=None,
            when="call",
            duration=0.01,
            context=SubtestContext(msg=None, kwargs={"index": index}),
        )
        data = report._to_json()
        data["$report_type"] = report.__class__.__name__
        return {
            "version": 1,
            "type": "report",
            "nodeid": nodeid,
            "attempt": 1,
            "when": "call",
            "outcome": "passed",
            "duration": report.duration,
            "report": data,
        }

    events = [
        {"version": 1, "type": "collection", "nodeids": [nodeid]},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 1},
        subtest_report(0),
        subtest_report(1),
        subtest_report(2),
        _report(nodeid, "setup", "passed", 1),
        _report(nodeid, "call", "passed", 1),
        _report(nodeid, "teardown", "passed", 1),
        {"version": 1, "type": "test_finish", "nodeid": nodeid, "attempt": 1, "final": True},
    ]
    _read_events(state, events)

    coordinator._read_worker_events(state, items, session, Mock(), final=True)

    reports = [call.kwargs["report"] for call in config_report_calls(session)]
    assert state.protocol_errors == []
    assert [report.when for report in reports] == [
        "setup",
        "call",
        "call",
        "call",
        "call",
        "teardown",
    ]
    assert [report.context.kwargs["index"] for report in reports[1:4]] == [0, 1, 2]
    assert type(reports[4]) is pytest.TestReport
    assert state.completed == [nodeid]


def config_report_calls(session: Any) -> list[Any]:
    return session.config.hook.pytest_runtest_logreport.call_args_list


def test_retry_protocol_rejects_wrong_attempt_number(tmp_path: Path) -> None:
    coordinator, state, session, items = _harness(tmp_path)
    nodeid = state.assigned[0]
    events = [
        {"version": 1, "type": "collection", "nodeids": [nodeid]},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 1},
        _report(nodeid, "setup", "rerun", 1),
        {"version": 1, "type": "test_finish", "nodeid": nodeid, "attempt": 1, "final": False},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 3},
    ]
    _read_events(state, events)

    coordinator._read_worker_events(state, items, session, Mock(), final=True)

    assert any("out-of-order retry start" in error for error in state.protocol_errors)


def test_worker_crash_after_rerun_keeps_replayed_attempt(tmp_path: Path) -> None:
    coordinator, state, session, items = _harness(tmp_path)
    nodeid = state.assigned[0]
    events = [
        {"version": 1, "type": "collection", "nodeids": [nodeid]},
        {"version": 1, "type": "test_start", "nodeid": nodeid, "attempt": 1},
        _report(nodeid, "setup", "passed", 1),
        _report(nodeid, "call", "rerun", 1),
        {"version": 1, "type": "test_finish", "nodeid": nodeid, "attempt": 1, "final": False},
    ]
    _read_events(state, events)
    coordinator._read_worker_events(state, items, session, Mock(), final=True)

    state.process.exitcode = -9
    coordinator._reconcile_worker(state, items, session, Mock(), None)

    outcomes = [call.kwargs["report"].outcome for call in config_report_calls(session)]
    assert "rerun" in outcomes
    assert "failed" in outcomes
    assert state.completed == []


def test_stop_between_attempts_finishes_protocol_without_completing_test(tmp_path: Path) -> None:
    nodeid = "test_retry.py::test_retry"
    results_path = tmp_path / "worker_results.jsonl"
    stop_path = tmp_path / "stop"
    reporter = ResultReporter(str(results_path), stop_path=stop_path)
    config = cast(Any, Mock())
    config.hook.pytest_report_to_serializable.return_value = None
    reporter.config = config
    session = cast(Any, Mock(Interrupted=Session.Interrupted, shouldstop=None))
    reporter.session = session

    reporter.pytest_runtest_logstart(nodeid, ("test_retry.py", 1, "test_retry"))
    reporter.pytest_runtest_logreport(
        pytest.TestReport(
            nodeid=nodeid,
            location=("test_retry.py", 1, "test_retry"),
            keywords={},
            outcome=cast(Any, "rerun"),
            longrepr="retry failed",
            when=cast(Any, "setup"),
            duration=0.01,
        )
    )
    stop_path.touch()

    with pytest.raises(Session.Interrupted):
        reporter.pytest_runtest_logfinish(nodeid, ("test_retry.py", 1, "test_retry"))

    finish = json.loads(results_path.read_text(encoding="utf-8").splitlines()[-1])
    assert finish["version"] == 1
    assert finish["attempt"] == 1
    assert finish["final"] is False
    assert session.shouldstop == "stopped by coordinator"


def test_duplicate_nodeids_start_as_distinct_first_attempts(tmp_path: Path) -> None:
    nodeid = "test_retry.py::test_retry"
    results_path = tmp_path / "worker_results.jsonl"
    reporter = ResultReporter(str(results_path), expected_nodeids=[nodeid, nodeid])

    for _ in range(2):
        reporter.pytest_runtest_logstart(nodeid, ("test_retry.py", 1, "test_retry"))
        for phase in ("setup", "call", "teardown"):
            reporter.pytest_runtest_logreport(
                pytest.TestReport(
                    nodeid=nodeid,
                    location=("test_retry.py", 1, "test_retry"),
                    keywords={},
                    outcome=cast(Any, "passed"),
                    longrepr=None,
                    when=cast(Any, phase),
                    duration=0.01,
                )
            )
        reporter.pytest_runtest_logfinish(nodeid, ("test_retry.py", 1, "test_retry"))

    events = [json.loads(line) for line in results_path.read_text(encoding="utf-8").splitlines()]
    starts = [event for event in events if event["type"] == "test_start"]
    assert [event["attempt"] for event in starts] == [1, 1]


def test_report_serialization_keeps_json_report_extra() -> None:
    reporter = ResultReporter("")
    config = cast(Any, Mock())
    config.hook.pytest_report_to_serializable.return_value = None
    reporter.config = config
    report = cast(
        Any,
        pytest.TestReport(
            nodeid="test_retry.py::test_retry",
            location=("test_retry.py", 1, "test_retry"),
            keywords={},
            outcome="passed",
            longrepr=None,
            when="call",
            duration=0.01,
        ),
    )
    report._json_report_extra = {"call": {"stdout": "attempt output"}, "metadata": {"worker": 0}}

    assert reporter._serialize_report(report)["_json_report_extra"] == report._json_report_extra
