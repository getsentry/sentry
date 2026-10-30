#!/usr/bin/env python3
"""Sample CPU/memory during backend CI shards to judge xdist headroom.

Starts a background sampler before the test run, stops it after, and uploads
per-shard usage as an artifact. To check whether one more xdist worker fits,
download the artifacts and compare peak CPU and memory against runner limits:

    gh run download RUN_ID --repo getsentry/sentry \\
        --pattern 'backend-resource-usage-*' --dir /tmp/usage
    python3 -c "import json,glob; ..."

Each shard writes `.artifacts/resource-usage.jsonl` (one sample per line) and
`.artifacts/resource-usage-summary.json` (aggregates plus a headroom verdict).
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path

INTERVAL_S = 5.0
STOP_TIMEOUT_S = 30

STATE_DIR = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "resource-monitor"
PID_FILE = STATE_DIR / "pid"
STOP_FILE = STATE_DIR / "stop"
LOG_FILE = STATE_DIR / "log"

CPU_HEADROOM_P95 = 75.0
CPU_HEADROOM_MAX = 90.0
CPU_MARGINAL_P95 = 85.0
MEM_HEADROOM_USED_PCT = 90.0
MEM_HEADROOM_MIN_AVAIL_GB = 1.0


def read_cpu_times() -> tuple[int, int] | None:
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()
        if not parts or parts[0] != "cpu":
            return None
        values = [int(v) for v in parts[1:]]
        idle = values[3] + values[4]
        return idle, sum(values)
    except (OSError, ValueError, IndexError):
        return None


def cpu_percent(prev: tuple[int, int] | None, curr: tuple[int, int] | None) -> float | None:
    if prev is None or curr is None:
        return None
    idle_delta = curr[0] - prev[0]
    total_delta = curr[1] - prev[1]
    if total_delta <= 0:
        return None
    return round(100.0 * (1.0 - idle_delta / total_delta), 1)


def read_mem() -> dict[str, float] | None:
    try:
        info: dict[str, int] = {}
        with open("/proc/meminfo") as f:
            for line in f:
                key, _, rest = line.partition(":")
                info[key.strip()] = int(rest.strip().split()[0])
        total = info.get("MemTotal", 0)
        avail = info.get("MemAvailable", info.get("MemFree", 0))
        if not total:
            return None
        swap_total = info.get("SwapTotal", 0)
        swap_free = info.get("SwapFree", 0)
        return {
            "total_kb": float(total),
            "available_kb": float(avail),
            "used_pct": round(100.0 * (total - avail) / total, 1),
            "swap_used_kb": float(swap_total - swap_free),
        }
    except (OSError, ValueError):
        return None


def read_load() -> list[float] | None:
    try:
        with open("/proc/loadavg") as f:
            return [float(v) for v in f.read().split()[:3]]
    except (OSError, ValueError):
        return None


def read_pressure(path: str) -> dict[str, float] | None:
    try:
        with open(path) as f:
            out: dict[str, float] = {}
            for token in f.read().split():
                if "=" in token:
                    k, v = token.split("=", 1)
                    out[k] = float(v)
            return out or None
    except (OSError, ValueError):
        return None


def sample(prev_cpu: tuple[int, int] | None) -> tuple[dict, tuple[int, int] | None]:
    curr_cpu = read_cpu_times()
    mem = read_mem()
    load = read_load()
    entry: dict = {"ts": round(time.time(), 1)}
    pct = cpu_percent(prev_cpu, curr_cpu)
    if pct is not None:
        entry["cpu_pct"] = pct
    if (cores := os.cpu_count()) is not None:
        entry["cpu_count"] = cores
    if mem is not None:
        entry["mem_used_pct"] = mem["used_pct"]
        entry["mem_available_gb"] = round(mem["available_kb"] / 1_048_576, 2)
        entry["swap_used_mb"] = round(mem["swap_used_kb"] / 1024, 1)
    if load is not None:
        entry["load_1m"], entry["load_5m"], entry["load_15m"] = (round(v, 2) for v in load)
    for name in ("cpu", "memory"):
        if (p := read_pressure(f"/proc/pressure/{name}")) is not None:
            entry[f"pressure_{name}_some_avg10"] = p.get("avg10")
    return entry, curr_cpu


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(pct / 100.0 * len(ordered)))
    return ordered[idx]


def summarize(samples: list[dict]) -> dict:
    cpus = [s["cpu_pct"] for s in samples if "cpu_pct" in s]
    mems = [s["mem_used_pct"] for s in samples if "mem_used_pct" in s]
    avails = [s["mem_available_gb"] for s in samples if "mem_available_gb" in s]
    swaps = [s["swap_used_mb"] for s in samples if "swap_used_mb" in s]
    loads = [s["load_1m"] for s in samples if "load_1m" in s]
    counts = {s["cpu_count"] for s in samples if "cpu_count" in s}

    cpu_p95 = round(percentile(cpus, 95), 1)
    cpu_max = round(max(cpus), 1) if cpus else 0.0
    cpu_avg = round(statistics.fmean(cpus), 1) if cpus else 0.0
    mem_max = round(max(mems), 1) if mems else 0.0
    avail_min = round(min(avails), 2) if avails else 0.0
    swap_max = round(max(swaps), 1) if swaps else 0.0

    if not cpus:
        cpu_verdict: str = "unknown"
    elif cpu_p95 < CPU_HEADROOM_P95 and cpu_max < CPU_HEADROOM_MAX:
        cpu_verdict = "headroom"
    elif cpu_p95 < CPU_MARGINAL_P95:
        cpu_verdict = "marginal"
    else:
        cpu_verdict = "saturated"

    if not mems:
        mem_verdict = "unknown"
    elif mem_max < MEM_HEADROOM_USED_PCT and avail_min > MEM_HEADROOM_MIN_AVAIL_GB:
        mem_verdict = "headroom"
    else:
        mem_verdict = "saturated"

    if cpu_verdict == "headroom" and mem_verdict == "headroom":
        overall = "likely headroom for +1 worker"
    elif "saturated" in (cpu_verdict, mem_verdict):
        overall = "no headroom for +1 worker"
    elif "unknown" in (cpu_verdict, mem_verdict):
        overall = "inconclusive (no samples)"
    else:
        overall = "marginal for +1 worker"

    summary = {
        "samples": len(samples),
        "duration_s": round(samples[-1]["ts"] - samples[0]["ts"], 1) if len(samples) > 1 else 0.0,
        "cpu_count": next(iter(counts), None),
        "cpu": {"avg_pct": cpu_avg, "p95_pct": cpu_p95, "max_pct": cpu_max},
        "memory": {
            "max_used_pct": mem_max,
            "min_available_gb": avail_min,
            "max_swap_used_mb": swap_max,
        },
        "load_1m_max": round(max(loads), 2) if loads else None,
        "headroom": {
            "cpu": cpu_verdict,
            "memory": mem_verdict,
            "one_more_worker": overall,
        },
    }
    return summary


def run_sampler(output: Path, interval: float) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    prev_cpu = read_cpu_times()
    with open(output, "a") as f:
        while not STOP_FILE.exists():
            time.sleep(interval)
            entry, prev_cpu = sample(prev_cpu)
            if len(entry) > 1:
                f.write(json.dumps(entry) + "\n")
                f.flush()


def start_background(output: Path, interval: float) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    for stale in (PID_FILE, STOP_FILE):
        try:
            stale.unlink()
        except OSError:
            pass
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "w") as log_file:
        proc = subprocess.Popen(
            [
                sys.executable,
                __file__,
                "--run-background",
                "--output",
                str(output),
                "--interval",
                str(interval),
            ],
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    PID_FILE.write_text(str(proc.pid))
    print(f"Started resource monitor (pid {proc.pid}), output: {output}")


def run_background(output: Path, interval: float) -> None:
    rc = 1
    try:
        run_sampler(output, interval)
        rc = 0
    finally:
        PID_FILE.write_text(f"{rc}\n")


def stop_background(output: Path, summary_path: Path | None) -> int:
    STOP_FILE.touch(exist_ok=True)
    deadline = time.monotonic() + STOP_TIMEOUT_S
    while time.monotonic() < deadline:
        if PID_FILE.exists():
            try:
                if int(PID_FILE.read_text().strip()) == 0:
                    break
            except ValueError:
                pass
        time.sleep(1)

    samples: list[dict] = []
    if output.exists():
        for line in output.read_text().splitlines():
            try:
                samples.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    summary = summarize(samples)
    if summary_path is not None:
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(summary, indent=2) + "\n")

    line = (
        f"samples={summary['samples']} duration_s={summary['duration_s']} "
        f"cpu_avg={summary['cpu']['avg_pct']}% cpu_p95={summary['cpu']['p95_pct']}% "
        f"cpu_max={summary['cpu']['max_pct']}% "
        f"mem_max={summary['memory']['max_used_pct']}% "
        f"mem_avail_min={summary['memory']['min_available_gb']}GB "
        f"swap_max={summary['memory']['max_swap_used_mb']}MB "
        f"verdict={summary['headroom']['one_more_worker']}"
    )
    print(line)
    if step_summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(step_summary, "a") as f:
            f.write(f"### Resource usage ({summary['samples']} samples)\n\n")
            f.write(f"{line}\n\n")
            f.write(f"```json\n{json.dumps(summary, indent=2)}\n```\n")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--output", type=Path, default=Path(".artifacts/resource-usage.jsonl"))
    parser.add_argument(
        "--summary", type=Path, default=Path(".artifacts/resource-usage-summary.json")
    )
    parser.add_argument("--interval", type=float, default=INTERVAL_S)
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--run-background", action="store_true")
    args = parser.parse_args()

    if args.start:
        start_background(args.output, args.interval)
    elif args.run_background:
        run_background(args.output, args.interval)
    elif args.stop:
        stop_background(args.output, args.summary)
    else:
        parser.error("expected one of --start, --stop, --run-background")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
