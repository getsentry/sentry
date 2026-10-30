from __future__ import annotations

import importlib

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
