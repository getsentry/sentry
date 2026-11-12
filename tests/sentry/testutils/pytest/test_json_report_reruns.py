from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Any

import pytest

from sentry.utils import json

INNER_TESTS = textwrap.dedent(
    """
    attempts = 0

    def test_subtests(subtests):
        for i in range(3):
            with subtests.test(msg="loop", i=i):
                assert i != 1, "subtest boom"

    def test_flaky_after_subtests(subtests):
        global attempts
        attempts += 1
        with subtests.test(attempt=attempts):
            pass
        assert attempts > 1, "first attempt fails"
    """
)


@pytest.fixture(params=[(), ("-n", "2", "--dist=loadfile")], ids=["inprocess", "xdist"])
def tests(request: pytest.FixtureRequest, tmp_path: Path) -> dict[str, dict[str, Any]]:
    (tmp_path / "pytest.ini").write_text("[pytest]\n")
    (tmp_path / "test_inner.py").write_text(INNER_TESTS)
    # Keep the outer run's options and settings out, and load exactly the
    # plugins CI combines.
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
            *request.param,
            "test_inner.py",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 1, proc.stdout + proc.stderr
    report = json.loads((tmp_path / "report.json").read_text())
    return {test["nodeid"].split("::")[1]: test for test in report["tests"]}


def test_subtests_are_not_reruns(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_subtests"]
    assert "reruns" not in test
    assert test["outcome"] == "failed"
    assert [(s["outcome"], s["context"]) for s in test["subtests"]] == [
        ("passed", {"msg": "loop", "kwargs": {"i": "0"}}),
        ("failed", {"msg": "loop", "kwargs": {"i": "1"}}),
        ("passed", {"msg": "loop", "kwargs": {"i": "2"}}),
    ]
    assert "AssertionError: subtest boom" in test["subtests"][1]["longrepr"]


def test_rerun_keeps_its_own_subtests(tests: dict[str, dict[str, Any]]) -> None:
    test = tests["test_flaky_after_subtests"]
    [rerun] = test["reruns"]
    assert rerun["call"]["outcome"] == "rerun"
    assert [s["context"]["kwargs"] for s in rerun["subtests"]] == [{"attempt": "1"}]
    assert [s["context"]["kwargs"] for s in test["subtests"]] == [{"attempt": "2"}]
    assert test["call"]["outcome"] == "passed"
