from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Any

import pytest

from sentry.utils import json

# Runs in a subprocess with the same plugin stack CI uses for backend shards.
INNER_TESTS = textwrap.dedent(
    """
    import pytest

    attempts = {"flaky": 0, "flaky_subtests": 0}

    @pytest.fixture
    def resource():
        yield 1

    def test_passing_subtests(subtests, resource):
        for i in range(3):
            with subtests.test(msg="loop", i=i):
                assert i < 3

    def test_failing_subtest(subtests, resource):
        for i in range(3):
            with subtests.test(i=i, kind="int"):
                assert i != 1, "subtest boom"

    def test_flaky():
        attempts["flaky"] += 1
        assert attempts["flaky"] > 1, "first attempt fails"

    def test_flaky_after_subtests(subtests):
        attempts["flaky_subtests"] += 1
        for i in range(2):
            with subtests.test(attempt=attempts["flaky_subtests"], i=i):
                pass
        assert attempts["flaky_subtests"] > 1, "first attempt fails"
    """
)


def run_inner(tmp_path: Path, *args: str) -> dict[str, dict[str, Any]]:
    (tmp_path / "pytest.ini").write_text("[pytest]\n")
    (tmp_path / "test_inner.py").write_text(INNER_TESTS)
    # Keep the outer run's PYTEST_ADDOPTS (CI sets --reruns and --fail-slow),
    # xdist worker variables and Django settings out of the inner run, and
    # load exactly the plugins CI combines.
    env = {
        k: v for k, v in os.environ.items() if not k.startswith(("PYTEST_", "DJANGO_", "SENTRY_"))
    }
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    plugins = (
        "xdist.plugin",
        "pytest_rerunfailures",
        "pytest_jsonreport.plugin",
        "sentry.testutils.pytest.json_report_reruns",
    )
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            *(arg for plugin in plugins for arg in ("-p", plugin)),
            "--json-report",
            "--json-report-file=report.json",
            "--reruns=1",
            *args,
            "test_inner.py",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    # test_failing_subtest fails, so a clean report still exits 1.
    assert proc.returncode == 1, proc.stdout + proc.stderr
    report = json.loads((tmp_path / "report.json").read_text())
    return {test["nodeid"].split("::")[1]: test for test in report["tests"]}


@pytest.fixture(params=[(), ("-n", "2", "--dist=loadfile")], ids=["inprocess", "xdist"])
def tests(request: pytest.FixtureRequest, tmp_path: Path) -> dict[str, dict[str, Any]]:
    return run_inner(tmp_path, *request.param)


def test_passing_subtests_are_not_reruns(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_passing_subtests"]
    assert "reruns" not in test
    assert test["outcome"] == "passed"
    assert [test[phase]["outcome"] for phase in ("setup", "call", "teardown")] == ["passed"] * 3
    assert [(s["outcome"], s["context"]) for s in test["subtests"]] == [
        ("passed", {"msg": "loop", "kwargs": {"i": "0"}}),
        ("passed", {"msg": "loop", "kwargs": {"i": "1"}}),
        ("passed", {"msg": "loop", "kwargs": {"i": "2"}}),
    ]
    assert all(s["duration"] >= 0 for s in test["subtests"])


def test_failed_subtest_keeps_context_and_traceback(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_failing_subtest"]
    assert "reruns" not in test
    assert test["outcome"] == "failed"
    assert test["setup"]["outcome"] == "passed"
    assert test["teardown"]["outcome"] == "passed"
    assert "contains 1 failed subtest" in test["call"]["longrepr"]
    assert [s["outcome"] for s in test["subtests"]] == ["passed", "failed", "passed"]
    failed = test["subtests"][1]
    assert failed["context"] == {"msg": None, "kwargs": {"i": "1", "kind": "'int'"}}
    assert "AssertionError: subtest boom" in failed["longrepr"]


def test_genuine_rerun_is_recorded(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_flaky"]
    assert len(test["reruns"]) == 1
    assert test["reruns"][0]["call"]["outcome"] == "rerun"
    assert "first attempt fails" in test["reruns"][0]["call"]["longrepr"]
    assert [test[phase]["outcome"] for phase in ("setup", "call", "teardown")] == ["passed"] * 3
    assert "subtests" not in test


def test_subtests_stay_with_their_attempt(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_flaky_after_subtests"]
    assert len(test["reruns"]) == 1
    rerun = test["reruns"][0]
    assert rerun["call"]["outcome"] == "rerun"
    assert [s["context"]["kwargs"] for s in rerun["subtests"]] == [
        {"attempt": "1", "i": "0"},
        {"attempt": "1", "i": "1"},
    ]
    assert [s["context"]["kwargs"] for s in test["subtests"]] == [
        {"attempt": "2", "i": "0"},
        {"attempt": "2", "i": "1"},
    ]
    assert test["setup"]["outcome"] == "passed"
    assert test["call"]["outcome"] == "passed"
