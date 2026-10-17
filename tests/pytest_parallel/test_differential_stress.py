from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest


def _clean_env(tmp_dir: Path | None = None) -> dict[str, str]:
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("_PYTEST_PARALLEL_WORKER_ENTRY", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    env["PYTEST_PLUGINS"] = "pytest_parallel.plugin"
    if tmp_dir is not None:
        env["TMPDIR"] = str(tmp_dir)
    return env


def _parse_junit(xml_path: Path) -> tuple[dict[str, str], list[tuple[str, str, str]]]:
    tree = ET.parse(xml_path)
    suite = tree.find("testsuite")
    assert suite is not None
    stats = {
        "tests": suite.attrib["tests"],
        "errors": suite.attrib["errors"],
        "failures": suite.attrib["failures"],
        "skipped": suite.attrib["skipped"],
    }
    cases: list[tuple[str, str, str]] = []
    for case in suite.findall("testcase"):
        classname = case.attrib.get("classname", "")
        name = case.attrib.get("name", "")
        if case.find("failure") is not None:
            tag = "failure"
        elif case.find("error") is not None:
            tag = "error"
        elif case.find("skipped") is not None:
            tag = "skipped"
        else:
            tag = "passed"
        cases.append((classname, name, tag))
    cases.sort()
    return stats, cases


def test_differential_mixed_suite_serial_vs_parallel(tmp_path: Path) -> None:
    suite_dir = tmp_path / "suite"
    suite_dir.mkdir()
    scratch_tmp = tmp_path / "tmp"
    scratch_tmp.mkdir()

    (suite_dir / "test_thousand.py").write_text(
        "import pytest\n"
        "@pytest.mark.parametrize('i', range(250))\n"
        "def test_tiny_a(i):\n"
        "    assert i >= 0\n"
    )
    (suite_dir / "test_thousand_b.py").write_text(
        "import pytest\n"
        "@pytest.mark.parametrize('i', range(250))\n"
        "def test_tiny_b(i):\n"
        "    assert i >= 0\n"
    )
    (suite_dir / "test_fixtures_and_outcomes.py").write_text(
        "import pytest\n\n"
        "MODULE_SETUP_COUNT = 0\n\n"
        "@pytest.fixture(scope='module', autouse=True)\n"
        "def mod_fix():\n"
        "    global MODULE_SETUP_COUNT\n"
        "    MODULE_SETUP_COUNT += 1\n"
        "    yield\n\n"
        "@pytest.fixture\n"
        "def err_setup():\n"
        "    raise ValueError('bad setup')\n\n"
        "@pytest.fixture\n"
        "def err_teardown():\n"
        "    yield\n"
        "    raise ValueError('bad teardown')\n\n"
        "def test_mod_count_1():\n"
        "    assert MODULE_SETUP_COUNT == 1\n\n"
        "def test_mod_count_2():\n"
        "    assert MODULE_SETUP_COUNT == 1\n\n"
        "def test_deliberate_fail():\n"
        "    print('stdout from deliberate fail')\n"
        "    assert 'a' == 'b'\n\n"
        "def test_deliberate_setup_err(err_setup):\n"
        "    pass\n\n"
        "def test_deliberate_teardown_err(err_teardown):\n"
        "    assert True\n\n"
        "def test_double_fail(err_teardown):\n"
        "    assert False\n\n"
        "@pytest.mark.skip(reason='skip me')\n"
        "def test_skipped():\n"
        "    pass\n\n"
        "@pytest.mark.xfail(reason='expected fail')\n"
        "def test_xfail():\n"
        "    assert False\n\n"
        "@pytest.mark.xfail(reason='unexpected pass')\n"
        "def test_xpass():\n"
        "    assert True\n\n"
        "@pytest.mark.parametrize('weird', ['a@b::c', 'x::y@z', 'λ::ω@π'])\n"
        "def test_weird_ids(weird):\n"
        "    assert len(weird) > 0\n"
    )

    serial_xml = tmp_path / "serial.xml"
    parallel_xml = tmp_path / "parallel.xml"

    serial_proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(suite_dir),
            "--serial",
            f"--junitxml={serial_xml}",
            "-q",
        ],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=suite_dir,
        env=_clean_env(scratch_tmp),
    )
    parallel_proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(suite_dir),
            "-j",
            "3",
            "--parallel-balance=count",
            f"--junitxml={parallel_xml}",
            "-q",
        ],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=suite_dir,
        env=_clean_env(scratch_tmp),
    )

    assert serial_proc.returncode == int(pytest.ExitCode.TESTS_FAILED)
    assert parallel_proc.returncode == serial_proc.returncode

    serial_stats, serial_cases = _parse_junit(serial_xml)
    parallel_stats, parallel_cases = _parse_junit(parallel_xml)
    assert parallel_stats == serial_stats
    assert parallel_cases == serial_cases
    assert list(scratch_tmp.glob("pytest_parallel_*")) == []


def test_sigint_cleans_up_workers_and_temp_dirs(tmp_path: Path) -> None:
    suite_dir = tmp_path / "suite"
    suite_dir.mkdir()
    scratch_tmp = tmp_path / "tmp"
    scratch_tmp.mkdir()
    ready_file = tmp_path / "worker_started.txt"
    pid_file = tmp_path / "worker_pid.txt"

    (suite_dir / "test_hang.py").write_text(
        "import os, time\n"
        "from pathlib import Path\n"
        f"READY = Path({str(ready_file)!r})\n"
        f"PID = Path({str(pid_file)!r})\n"
        "def test_sleep():\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        PID.write_text(str(os.getpid()))\n"
        "        READY.write_text('1')\n"
        "        time.sleep(10.0)\n"
    )

    proc = subprocess.Popen(
        [sys.executable, "-m", "pytest", str(suite_dir), "-j", "1", "-q"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=suite_dir,
        env=_clean_env(scratch_tmp),
    )
    deadline = time.monotonic() + 5.0
    while not ready_file.exists() and time.monotonic() < deadline:
        time.sleep(0.02)
    assert ready_file.exists()

    proc.send_signal(signal.SIGINT)
    stdout, _ = proc.communicate(timeout=5.0)
    assert proc.returncode != 0, stdout

    if pid_file.exists():
        worker_pid = int(pid_file.read_text().strip())
        deadline = time.monotonic() + 2.0
        alive = True
        while time.monotonic() < deadline:
            try:
                os.kill(worker_pid, 0)
                time.sleep(0.02)
            except OSError:
                alive = False
                break
        assert not alive

    assert list(scratch_tmp.glob("pytest_parallel_*")) == []


def test_repeated_parallel_runs_have_deterministic_results(tmp_path: Path) -> None:
    suite_dir = tmp_path / "suite"
    suite_dir.mkdir()
    scratch_tmp = tmp_path / "tmp"
    scratch_tmp.mkdir()

    for file_idx in range(4):
        (suite_dir / f"test_mod_{file_idx}.py").write_text(
            "import pytest\n"
            "@pytest.mark.parametrize('k', range(10))\n"
            "def test_item(k):\n"
            "    assert k < 10\n"
        )

    for run_idx in range(3):
        xml_path = tmp_path / f"run_{run_idx}.xml"
        res = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                str(suite_dir),
                "-j",
                "2",
                f"--junitxml={xml_path}",
                "-q",
            ],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=suite_dir,
            env=_clean_env(scratch_tmp),
        )
        assert res.returncode == 0, res.stdout
        stats, cases = _parse_junit(xml_path)
        assert stats == {"tests": "40", "errors": "0", "failures": "0", "skipped": "0"}
        assert len(cases) == 40
    assert list(scratch_tmp.glob("pytest_parallel_*")) == []


def measure_suite_benchmark(
    suite_dir: Path, extra_args: list[str], scratch_tmp: Path
) -> dict[str, float]:
    import resource

    from pytest_parallel.plugin import BalanceStrategy
    from pytest_parallel.scheduling import FileUnit, assign_units, merge_units

    collect_start = time.monotonic()
    subprocess.run(
        [sys.executable, "-m", "pytest", str(suite_dir), "--collect-only", "--serial", "-q"],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=suite_dir,
        env=_clean_env(scratch_tmp),
    )
    collection_overhead_s = time.monotonic() - collect_start

    rusage_before = resource.getrusage(resource.RUSAGE_CHILDREN)
    wall_start = time.monotonic()
    subprocess.run(
        [sys.executable, "-m", "pytest", str(suite_dir), *extra_args, "-q"],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=suite_dir,
        env=_clean_env(scratch_tmp),
    )
    wall_time_s = time.monotonic() - wall_start
    rusage_after = resource.getrusage(resource.RUSAGE_CHILDREN)
    cpu_time_s = (rusage_after.ru_utime - rusage_before.ru_utime) + (
        rusage_after.ru_stime - rusage_before.ru_stime
    )

    balance: BalanceStrategy = (
        "count" if "--parallel-balance=count" in extra_args else "round-robin"
    )
    files: list[FileUnit] = []
    for file_path in sorted(suite_dir.glob("test_*.py")):
        count = int(file_path.stem.rsplit("_", 1)[-1])
        file_unit = FileUnit(path=file_path, key=file_path.name, ordinal=len(files))
        file_unit.weight = float(count)
        file_unit.items = list(range(count))
        files.append(file_unit)
    buckets = assign_units(merge_units(files), 2, balance=balance)
    loads = [sum(unit.weight for unit in bucket) for bucket in buckets if bucket]
    mean_load = sum(loads) / len(loads) if loads else 1.0
    imbalance_ratio = max(loads) / mean_load if mean_load > 0 else 1.0

    return {
        "wall_time_s": wall_time_s,
        "cpu_time_s": cpu_time_s,
        "collection_overhead_s": collection_overhead_s,
        "startup_overhead_s": max(0.0, wall_time_s - collection_overhead_s),
        "imbalance_ratio": imbalance_ratio,
        "peak_rss": float(rusage_after.ru_maxrss),
    }


def test_schedule_imbalance_and_benchmark_metrics(tmp_path: Path) -> None:
    suite_dir = tmp_path / "skewed"
    suite_dir.mkdir()
    scratch_tmp = tmp_path / "tmp"
    scratch_tmp.mkdir()

    for idx, count in enumerate((40, 4, 40, 4)):
        (suite_dir / f"test_{idx}_{count}.py").write_text(
            "import pytest\n"
            f"@pytest.mark.parametrize('i', range({count}))\n"
            "def test_item(i):\n"
            "    assert i >= 0\n"
        )

    rr_metrics = measure_suite_benchmark(
        suite_dir, ["-j", "2", "--parallel-balance=round-robin"], scratch_tmp
    )
    count_metrics = measure_suite_benchmark(
        suite_dir, ["-j", "2", "--parallel-balance=count"], scratch_tmp
    )

    assert rr_metrics["imbalance_ratio"] > 1.5
    assert count_metrics["imbalance_ratio"] == 1.0
    assert count_metrics["peak_rss"] > 0
