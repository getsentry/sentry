from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from pytest_parallel.plugin import _parse_balance, _parse_jobs, _parse_ramp, _parse_start_method


def test_auto_uses_process_cpu_count(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("pytest_parallel.plugin.os.process_cpu_count", lambda: 12)
    monkeypatch.setattr("pytest_parallel.plugin.os.cpu_count", lambda: 64)

    assert _parse_jobs("auto") == 12


def test_auto_falls_back_to_cpu_count_then_one_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("pytest_parallel.plugin.os.process_cpu_count", lambda: None)
    monkeypatch.setattr("pytest_parallel.plugin.os.cpu_count", lambda: 6)
    assert _parse_jobs("auto") == 6

    monkeypatch.setattr("pytest_parallel.plugin.os.cpu_count", lambda: None)
    assert _parse_jobs("auto") == 1


def test_auto_honors_python_cpu_count_override(tmp_path: Path) -> None:
    test_file = tmp_path / "test_cpu.py"
    for idx in range(5):
        (tmp_path / f"test_cpu_{idx}.py").write_text("def test_ok():\n    assert True\n")
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)
    env["PYTHON_CPU_COUNT"] = "3"

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(tmp_path), "-q", "-j", "auto"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    assert result.returncode == 0, result.stdout
    assert "pytest-parallel: 3 workers, 5 tests" in result.stdout
    assert not test_file.exists()


def test_numeric_worker_count() -> None:
    assert _parse_jobs("4") == 4
    assert _parse_jobs(4) == 4
    assert _parse_jobs("0") == 0


@pytest.mark.parametrize("bad_value", ["-1", -3, "abc", "1.5", "", True, False])
def test_invalid_jobs_raises_usage_error(bad_value: object) -> None:
    with pytest.raises(pytest.UsageError):
        _parse_jobs(bad_value)


def test_worker_count_capped_by_schedulable_file_groups(tmp_path: Path) -> None:
    test_file = tmp_path / "test_many_in_one_file.py"
    test_file.write_text(
        "import pytest\n"
        "@pytest.mark.parametrize('i', range(50))\n"
        "def test_param(i):\n"
        "    assert i >= 0\n"
    )
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-q", "-j", "8"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    assert result.returncode == 0, result.stdout
    assert "pytest-parallel: 1 workers, 50 tests" in result.stdout
    assert "requested 8 workers capped to 1 (1 scheduling units)" in result.stdout


def test_invalid_max_workers_hook_raises_usage_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "test_a.py").write_text("def test_a():\n    assert True\n")
    monkeypatch.delenv("_PYTEST_PARALLEL_WORKER", raising=False)
    monkeypatch.delenv("PYTEST_PARALLEL_WORKER_ID", raising=False)

    class BadMaxWorkersPlugin:
        def pytest_parallel_max_workers(self) -> int:
            return 0

    rc = pytest.main([str(tmp_path), "-j", "2", "-q"], plugins=[BadMaxWorkersPlugin()])
    assert rc == int(pytest.ExitCode.USAGE_ERROR)


def test_parse_ramp_valid_durations() -> None:
    assert _parse_ramp(None) == 0.0
    assert _parse_ramp("0") == 0.0
    assert _parse_ramp("2.5") == 2.5
    assert _parse_ramp("3s") == 3.0
    assert _parse_ramp("1.5m") == 90.0
    assert _parse_ramp("0.5h") == 1800.0


@pytest.mark.parametrize("bad_ramp", ["-1", "-0.5s", "nan", "inf", "-inf", "10ms", "abc", "", True])
def test_parse_ramp_rejects_invalid_values(bad_ramp: object) -> None:
    with pytest.raises(pytest.UsageError):
        _parse_ramp(bad_ramp)


def test_parse_balance_options() -> None:
    assert _parse_balance("round-robin") == "round-robin"
    assert _parse_balance("count") == "count"
    with pytest.raises(pytest.UsageError):
        _parse_balance("random")


def test_parse_start_method_options() -> None:
    assert _parse_start_method("auto") == "auto"
    assert _parse_start_method("fork") == "fork"
    assert _parse_start_method("spawn") == "spawn"
    assert _parse_start_method("forkserver") == "forkserver"
    with pytest.raises(pytest.UsageError):
        _parse_start_method("invalid")
