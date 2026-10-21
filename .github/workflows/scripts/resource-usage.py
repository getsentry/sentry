#!/usr/bin/env python3
"""Sample runner CPU and memory in the background and summarize it.

Usage:
  resource-usage.py start FILE   Fork a sampler that appends to FILE.
  resource-usage.py stop FILE    Stop the sampler and print a summary.

Per-process RSS is summed by command name, so processes that share pages
(Chrome's renderers, forked Python workers) are overcounted somewhat.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from collections import defaultdict

INTERVAL = 2.0


def read_cpu() -> tuple[int, int, int]:
    with open("/proc/stat") as f:
        fields = [int(x) for x in f.readline().split()[1:]]
    idle = fields[3]
    iowait = fields[4]
    return sum(fields), idle, iowait


def read_mem_mb() -> tuple[int, int, int]:
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, value = line.split(":", 1)
            info[key] = int(value.split()[0]) // 1024
    used = info["MemTotal"] - info["MemAvailable"]
    swap = info["SwapTotal"] - info["SwapFree"]
    return info["MemTotal"], used, swap


def rss_by_command_mb() -> dict[str, int]:
    out = subprocess.run(
        ["ps", "-eo", "rss=,comm="], capture_output=True, text=True, check=False
    ).stdout
    groups: dict[str, int] = defaultdict(int)
    for line in out.splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2:
            groups[parts[1].strip()] += int(parts[0])
    return {k: v // 1024 for k, v in groups.items()}


def sample_forever(path: str) -> None:
    prev = read_cpu()
    with open(path, "a") as f:
        while True:
            time.sleep(INTERVAL)
            cur = read_cpu()
            total = cur[0] - prev[0] or 1
            busy = 100 * (total - (cur[1] - prev[1]) - (cur[2] - prev[2])) / total
            iowait = 100 * (cur[2] - prev[2]) / total
            prev = cur
            mem_total, mem_used, swap = read_mem_mb()
            with open("/proc/loadavg") as la:
                load1 = float(la.read().split()[0])
            record = {
                "t": time.time(),
                "cpu_busy": round(busy, 1),
                "cpu_iowait": round(iowait, 1),
                "load1": load1,
                "mem_total": mem_total,
                "mem_used": mem_used,
                "swap_used": swap,
                "rss": rss_by_command_mb(),
            }
            f.write(json.dumps(record) + "\n")
            f.flush()


def start(path: str) -> None:
    if os.fork():
        return
    os.setsid()
    if os.fork():
        os._exit(0)
    with open(path + ".pid", "w") as f:
        f.write(str(os.getpid()))
    devnull = os.open(os.devnull, os.O_RDWR)
    for fd in (0, 1, 2):
        os.dup2(devnull, fd)
    sample_forever(path)


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * len(ordered)))]


def stop(path: str) -> None:
    try:
        with open(path + ".pid") as f:
            os.kill(int(f.read()), signal.SIGTERM)
    except (OSError, ValueError):
        pass

    try:
        with open(path) as f:
            records = [json.loads(line) for line in f if line.strip()]
    except OSError:
        records = []
    if not records:
        print("no resource samples recorded")
        return

    busy = [r["cpu_busy"] for r in records]
    iowait = [r["cpu_iowait"] for r in records]
    used = [r["mem_used"] for r in records]
    peak_rss: dict[str, int] = defaultdict(int)
    for r in records:
        for name, mb in r["rss"].items():
            peak_rss[name] = max(peak_rss[name], mb)
    top = sorted(peak_rss.items(), key=lambda kv: -kv[1])[:12]

    lines = [
        f"samples: {len(records)} over {records[-1]['t'] - records[0]['t']:.0f}s, "
        f"{os.cpu_count()} CPUs",
        f"cpu busy %: mean {sum(busy) / len(busy):.0f}, p50 {pct(busy, 0.5):.0f}, "
        f"p90 {pct(busy, 0.9):.0f}, max {max(busy):.0f}; "
        f"iowait mean {sum(iowait) / len(iowait):.1f}",
        f"load1 max: {max(r['load1'] for r in records):.1f}",
        f"memory used MB: p50 {pct(used, 0.5)}, max {max(used)} of {records[0]['mem_total']}; "
        f"swap max {max(r['swap_used'] for r in records)}",
        "peak RSS MB by command: " + ", ".join(f"{k}={v}" for k, v in top),
    ]
    summary = "\n".join(lines)
    print(summary)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a") as f:
            f.write("### Runner resource usage during tests\n```\n" + summary + "\n```\n")


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in ("start", "stop"):
        sys.exit(__doc__)
    {"start": start, "stop": stop}[sys.argv[1]](sys.argv[2])


if __name__ == "__main__":
    main()
