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
    import json
    import os

    import pytest
    import pytest_sentry
    import sentry_sdk


    class FileTransport(sentry_sdk.Transport):
        def capture_envelope(self, envelope):
            event = envelope.get_event()
            if event is None:
                return
            with open(os.environ["EVENTS_FILE"], "a") as f:
                f.write(json.dumps({
                    "exception": event["exception"]["values"][-1]["value"],
                    "tags": {
                        k: v for k, v in event.get("tags", {}).items() if k.startswith("pytest.")
                    },
                }) + "\\n")


    pytestmark = pytest.mark.sentry_client(
        pytest_sentry.Client(
            dsn="https://key@sentry.invalid/1",
            transport=FileTransport(),
            traces_sample_rate=0.0,
        )
    )

    attempts = {"flaky": 0, "broken": 0}


    def test_flaky():
        attempts["flaky"] += 1
        assert attempts["flaky"] > 2, f"flaky {attempts['flaky']}"


    def test_broken():
        attempts["broken"] += 1
        assert False, f"broken {attempts['broken']}"


    def test_ok():
        pass
    """
)


def _run(tmp_path: Path, always_report: bool, *args: str) -> list[dict[str, Any]]:
    (tmp_path / "pytest.ini").write_text("[pytest]\n")
    (tmp_path / "test_inner.py").write_text(INNER_TESTS)
    events_file = tmp_path / "events.jsonl"
    # Keep the outer run's options and settings out, and load exactly the
    # plugins CI combines.
    env = {
        k: v for k, v in os.environ.items() if not k.startswith(("PYTEST_", "DJANGO_", "SENTRY_"))
    }
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    env["EVENTS_FILE"] = str(events_file)
    if always_report:
        env["PYTEST_SENTRY_ALWAYS_REPORT"] = "1"
    plugins = (
        "xdist.plugin",
        "pytest_rerunfailures",
        "pytest_sentry",
        "sentry.testutils.pytest.pytest_sentry_reruns",
    )
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            *(arg for plugin in plugins for arg in ("-p", plugin)),
            "--reruns=2",
            *args,
            "test_inner.py",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 1, proc.stdout + proc.stderr
    if not events_file.exists():
        return []
    events = [json.loads(line) for line in events_file.read_text().splitlines()]
    return sorted(events, key=lambda e: e["exception"])


@pytest.mark.parametrize("args", [(), ("-n", "2")], ids=["inprocess", "xdist"])
def test_always_report_sends_each_attempt_once(tmp_path: Path, args: tuple[str, ...]) -> None:
    events = _run(tmp_path, True, *args)
    assert [
        (
            e["exception"].splitlines()[0],
            e["tags"]["pytest.result"],
            e["tags"]["pytest.attempt"],
            e["tags"]["pytest.final_attempt"],
        )
        for e in events
    ] == [
        ("broken 1", "failed", "1", "false"),
        ("broken 2", "failed", "2", "false"),
        ("broken 3", "failed", "3", "true"),
        ("flaky 1", "failed", "1", "false"),
        ("flaky 2", "failed", "2", "false"),
    ]


def test_without_always_report_flaky_tests_still_report_on_pass(tmp_path: Path) -> None:
    events = _run(tmp_path, False)
    assert [(e["exception"].splitlines()[0], e["tags"]["pytest.result"]) for e in events] == [
        ("flaky 1", "passed"),
        ("flaky 2", "passed"),
    ]
