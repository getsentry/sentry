from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

pytest.importorskip("pytest_rerunfailures")


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTEST_ADDOPTS"] = ""
    for name in ("_PYTEST_PARALLEL_WORKER", "_PYTEST_PARALLEL_WORKER_ENTRY", "PYTEST_PARALLEL_WORKER_ID"):
        env.pop(name, None)
    return env


def _run_json_suite(tmp_path: Path, test_source: str, *, reruns: int = 1) -> tuple[subprocess.CompletedProcess[str], dict]:
    pytest.importorskip("pytest_jsonreport")
    test_file = tmp_path / "test_retry.py"
    test_file.write_text(test_source, encoding="utf-8")
    json_path = tmp_path / "report.json"
    junit_path = tmp_path / "report.xml"
    worker_write_marker = tmp_path / "worker-wrote-report"
    (tmp_path / "conftest.py").write_text(
        textwrap.dedent(
            """
            import os
            from pathlib import Path
            import pytest
            from pytest_jsonreport.plugin import JSONReport

            class RerunJSONReporter:
                def __init__(self, json_tests):
                    self.json_tests = json_tests

                def pytest_json_runtest_stage(self, report):
                    item = self.json_tests[report.nodeid]
                    if report.when in item:
                        reruns = item.setdefault("reruns", [])
                        reruns.append({key: item.pop(key) for key in ("setup", "call", "teardown") if key in item})

            def pytest_plugin_registered(plugin, manager):
                if isinstance(plugin, JSONReport):
                    manager.register(RerunJSONReporter(plugin._json_tests))

            def pytest_json_runtest_metadata(item, call):
                if os.environ.get("_PYTEST_PARALLEL_WORKER") == "1":
                    report = getattr(item.config, "_json_report", None)
                    route = item.config.pluginmanager.get_plugin("pytest-parallel-json-report")
                    Path(os.environ["PYTEST_JSON_WORKER_MARKER"]).write_text(
                        f"{type(report).__name__}:{route is not None}:{item.config.getoption('json_report')}"
                    )
                return {"attempt": getattr(item, "execution_count", None), "name": item.name}
            """
        ),
        encoding="utf-8",
    )
    env = _clean_env()
    env["PYTEST_JSON_REPORT_FILE"] = str(json_path)
    env["PYTEST_JSON_WORKER_MARKER"] = str(worker_write_marker)
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(test_file),
            "-j",
            "1",
            f"--reruns={reruns}",
            "--json-report",
            f"--json-report-file={json_path}",
            f"--junitxml={junit_path}",
            "-q",
        ],
        cwd=tmp_path,
        env=env,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    assert json_path.exists(), result.stdout
    assert junit_path.exists(), result.stdout
    assert worker_write_marker.read_text(encoding="utf-8") == "JSONReportWorker:True:True", result.stdout
    return result, json.loads(json_path.read_text(encoding="utf-8"))


def test_fail_then_pass_preserves_report_extras_and_single_writer_files(tmp_path: Path) -> None:
    counter = tmp_path / "attempts.txt"
    source = textwrap.dedent(
        f"""
        from pathlib import Path
        counter = Path({str(counter)!r})

        def test_flaky():
            attempt = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(attempt))
            print(f"attempt {{attempt}}")
            assert attempt == 2
        """
    )

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode == 0, result.stdout
    assert counter.read_text(encoding="utf-8") == "2"
    test = report["tests"][0]
    assert test["outcome"] == "passed"
    assert test["metadata"] == {"attempt": 2, "name": "test_flaky"}
    assert test["call"]["stdout"] == "attempt 2\n"
    assert test["reruns"][0]["call"]["stdout"] == "attempt 1\n"
    xml_root = ET.parse(tmp_path / "report.xml").find("testsuite")
    assert xml_root is not None
    assert xml_root.attrib["tests"] == "1"
    assert len(xml_root.findall("testcase")) == 1


def test_exhausted_reruns_finish_as_one_failed_test(tmp_path: Path) -> None:
    source = "def test_always_fails():\n    assert False, 'retry exhausted'\n"

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode == 1, result.stdout
    test = report["tests"][0]
    assert test["outcome"] == "failed"
    assert len(test["reruns"]) == 1
    assert report["summary"]["total"] == 1
    assert report["summary"]["failed"] == 1


def test_setup_rerun_replays_setup_attempt(tmp_path: Path) -> None:
    counter = tmp_path / "setup.txt"
    source = textwrap.dedent(
        f"""
        from pathlib import Path
        import pytest
        counter = Path({str(counter)!r})

        @pytest.fixture
        def flaky_setup():
            attempt = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(attempt))
            if attempt == 1:
                raise RuntimeError("first setup")

        def test_setup_retry(flaky_setup):
            assert True
        """
    )

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode == 0, result.stdout
    test = report["tests"][0]
    assert test["outcome"] == "passed"
    assert len(test["reruns"]) == 1
    assert test["reruns"][0]["setup"]["outcome"] == "rerun"


def test_teardown_rerun_replays_teardown_attempt(tmp_path: Path) -> None:
    counter = tmp_path / "teardown.txt"
    source = textwrap.dedent(
        f"""
        from pathlib import Path
        import pytest
        counter = Path({str(counter)!r})

        @pytest.fixture
        def flaky_teardown():
            yield
            attempt = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(attempt))
            if attempt == 1:
                raise RuntimeError("first teardown")

        def test_teardown_retry(flaky_teardown):
            assert True
        """
    )

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode == 0, result.stdout
    test = report["tests"][0]
    assert test["outcome"] == "passed"
    assert len(test["reruns"]) == 1
    assert test["reruns"][0]["teardown"]["outcome"] == "rerun"


def test_failed_attempt_followed_by_skip_is_final_skip(tmp_path: Path) -> None:
    counter = tmp_path / "skip.txt"
    source = textwrap.dedent(
        f"""
        from pathlib import Path
        import pytest
        counter = Path({str(counter)!r})

        def test_fail_then_skip():
            attempt = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(attempt))
            if attempt == 1:
                assert False, "first call"
            pytest.skip("skip on retry")
        """
    )

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode == 0, result.stdout
    test = report["tests"][0]
    assert test["outcome"] == "skipped"
    assert len(test["reruns"]) == 1
    assert test["reruns"][0]["call"]["outcome"] == "rerun"


def test_crash_during_retry_keeps_the_first_attempt_report(tmp_path: Path) -> None:
    counter = tmp_path / "crash.txt"
    source = textwrap.dedent(
        f"""
        import os
        from pathlib import Path
        counter = Path({str(counter)!r})

        def test_crashes_on_retry():
            attempt = int(counter.read_text()) + 1 if counter.exists() else 1
            counter.write_text(str(attempt))
            if attempt == 2:
                os._exit(17)
            assert False, "first call"
        """
    )

    result, report = _run_json_suite(tmp_path, source)

    assert result.returncode != 0, result.stdout
    test = report["tests"][0]
    assert test["outcome"] == "error"
    assert len(test["reruns"]) == 1
    assert test["reruns"][0]["call"]["outcome"] == "rerun"
    assert "worker 0 failure" in test["setup"]["longrepr"]
    assert counter.read_text(encoding="utf-8") == "2"


@pytest.mark.parametrize(
    ("pause_point", "expected_attempts"),
    [("between_attempts", 1), ("in_flight_retry", 2)],
    ids=["between-attempts", "in-flight-retry"],
)
def test_maxfail_coordinates_retry_with_another_worker(
    tmp_path: Path,
    pause_point: str,
    expected_attempts: int,
) -> None:
    retry_started = tmp_path / "retry-started"
    retry_release = tmp_path / "retry-release"
    counter = tmp_path / "retry-attempts.txt"
    pause_hook = (
        """
        @pytest.hookimpl(tryfirst=True)
        def pytest_runtest_logfinish(nodeid, location):
            if nodeid.endswith("test_retry"):
                pause_retry()
        """
        if pause_point == "between_attempts"
        else """
        @pytest.hookimpl(tryfirst=True)
        def pytest_runtest_setup(item):
            if item.name == "test_retry" and getattr(item, "execution_count", 1) > 1:
                pause_retry()
        """
    )
    pause_hook = textwrap.indent(textwrap.dedent(pause_hook), "            ")
    (tmp_path / "conftest.py").write_text(
        textwrap.dedent(
            f"""
            import os
            import pytest
            import time

            def pause_retry():
                from pathlib import Path
                release = Path(os.environ["PYTEST_RETRY_RELEASE"])
                Path(os.environ["PYTEST_RETRY_STARTED"]).touch()
                deadline = time.monotonic() + 8
                while not release.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                if not release.exists():
                    raise TimeoutError("coordinator did not release the paused retry")

{pause_hook}
            """
        ),
        encoding="utf-8",
    )
    (tmp_path / "test_a_retry.py").write_text(
        textwrap.dedent(
            f"""
            from pathlib import Path
            counter = Path({str(counter)!r})

            def test_retry():
                attempt = int(counter.read_text()) + 1 if counter.exists() else 1
                counter.write_text(str(attempt))
                assert attempt == 2
            """
        ),
        encoding="utf-8",
    )
    (tmp_path / "test_b_failure.py").write_text(
        textwrap.dedent(
            f"""
            import time
            from pathlib import Path
            started = Path({str(retry_started)!r})

            def test_failure():
                deadline = time.monotonic() + 8
                while not started.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                assert started.exists(), "retry worker did not reach its pause point"
                assert False
            """
        ),
        encoding="utf-8",
    )
    driver = tmp_path / "run_pytest.py"
    driver.write_text(
        textwrap.dedent(
            """
            import sys
            import threading
            import pytest
            from pytest_parallel.coordinator import Coordinator

            def main():
                stopped = threading.Event()
                original = Coordinator._trigger_global_stop

                def trigger(stop_path, worker_states):
                    original(stop_path, worker_states)
                    stopped.set()

                Coordinator._trigger_global_stop = staticmethod(trigger)

                def release_retry():
                    if stopped.wait(5):
                        from pathlib import Path
                        Path(sys.argv[1]).touch()

                releaser = threading.Thread(target=release_retry, daemon=True)
                releaser.start()
                result = pytest.main(sys.argv[2:])
                releaser.join(1)
                raise SystemExit(int(result))

            if __name__ == "__main__":
                main()
            """
        ),
        encoding="utf-8",
    )
    env = _clean_env()
    env["PYTEST_RETRY_STARTED"] = str(retry_started)
    env["PYTEST_RETRY_RELEASE"] = str(retry_release)
    result = subprocess.run(
        [
            sys.executable,
            str(driver),
            str(retry_release),
            str(tmp_path),
            "-j",
            "2",
            "--reruns=1",
            "--maxfail=1",
            "--parallel-drain=1s",
            "-q",
        ],
        cwd=tmp_path,
        env=env,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=12,
    )

    assert result.returncode == 1, result.stdout
    assert "stopping after 1 failures" in result.stdout
    assert counter.read_text(encoding="utf-8") == str(expected_attempts)
