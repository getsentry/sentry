from __future__ import annotations

import importlib
import time

_mod = importlib.import_module("monitor-resources")


def _sample(cpu: float, mem: float, avail: float, ts: float) -> dict:
    return {
        "ts": ts,
        "cpu_pct": cpu,
        "cpu_count": 4,
        "mem_used_pct": mem,
        "mem_available_gb": avail,
        "swap_used_mb": 0.0,
        "load_1m": 2.0,
    }


def test_summarize_headroom() -> None:
    samples = [_sample(50.0, 60.0, 5.0, float(i)) for i in range(20)]
    summary = _mod.summarize(samples)
    assert summary["samples"] == 20
    assert summary["cpu"]["avg_pct"] == 50.0
    assert summary["headroom"] == {
        "cpu": "headroom",
        "memory": "headroom",
        "one_more_worker": "likely headroom for +1 worker",
    }


def test_summarize_saturated_cpu() -> None:
    samples = [_sample(95.0, 60.0, 5.0, float(i)) for i in range(20)]
    summary = _mod.summarize(samples)
    assert summary["headroom"]["cpu"] == "saturated"
    assert summary["headroom"]["one_more_worker"] == "no headroom for +1 worker"


def test_summarize_saturated_memory() -> None:
    samples = [_sample(50.0, 95.0, 0.2, float(i)) for i in range(20)]
    summary = _mod.summarize(samples)
    assert summary["headroom"]["memory"] == "saturated"
    assert summary["headroom"]["one_more_worker"] == "no headroom for +1 worker"


def test_summarize_no_samples_is_inconclusive() -> None:
    assert _mod.summarize([])["headroom"]["one_more_worker"] == "inconclusive (no samples)"


def test_summarize_cpu_by_group_splits_out_test_run() -> None:
    samples = [
        {"ts": 0.0, "cpu_s_by_group": {"docker:postgres-postgres-1": 3.0}},
        {"ts": 5.0, "cpu_s_by_group": {"pytest:worker": 12.0, "docker:postgres-postgres-1": 4.0}},
        {"ts": 10.0, "cpu_s_by_group": {"pytest:worker": 10.0, "docker:snuba-gw0": 2.5}},
    ]
    summary = _mod.summarize(samples)
    assert summary["cpu_s_by_group"] == {
        "pytest:worker": 22.0,
        "docker:postgres-postgres-1": 7.0,
        "docker:snuba-gw0": 2.5,
    }
    assert summary["cpu_s_by_group_during_tests"] == {
        "pytest:worker": 22.0,
        "docker:postgres-postgres-1": 4.0,
        "docker:snuba-gw0": 2.5,
    }


def test_read_pressure_uses_some_line(tmp_path) -> None:
    psi = tmp_path / "cpu"
    psi.write_text(
        "some avg10=42.50 avg60=30.00 avg300=10.00 total=123\n"
        "full avg10=0.00 avg60=0.00 avg300=0.00 total=0\n"
    )
    assert _mod.read_pressure(str(psi))["avg10"] == 42.5


def test_classify_process() -> None:
    worker = "python -c import sys;exec(eval(sys.stdin.readline()))"
    assert _mod.classify_process(worker, "python") == "pytest:worker"
    assert (
        _mod.classify_process(
            "python3 -b .github/workflows/scripts/pytest-selected.py tests", "python3"
        )
        == "pytest:main"
    )
    assert _mod.classify_process("", "kworker/0:1") == "kernel"
    assert (
        _mod.classify_process("/usr/bin/docker-proxy -proto tcp", "docker-proxy") == "docker-proxy"
    )


def test_tracker_attributes_cpu_on_this_host() -> None:
    tracker = _mod.ProcessCpuTracker()
    assert tracker.sample() == {}
    deadline = time.monotonic() + 0.3
    while time.monotonic() < deadline:
        pass
    groups = tracker.sample()
    assert groups.get("pytest:main", 0) > 0
