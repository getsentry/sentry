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

Each sample also attributes CPU to process groups: docker containers by name,
xdist workers, the pytest controller, and other host processes by command name.
CPU that exited between samples shows up as `unattributed`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
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

CPU_MODES = ("user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal")
CLK_TCK = os.sysconf("SC_CLK_TCK")
DOCKER_ID_RE = re.compile(r"docker[-/]([0-9a-f]{64})")
# execnet starts xdist workers as `python -c "import sys;exec(eval(sys.stdin.readline()))"`.
XDIST_WORKER_MARKER = "exec(eval(sys.stdin.readline()))"
CONTAINER_REFRESH_S = 5.0


def read_cpu_times() -> dict[str, int] | None:
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()
        if not parts or parts[0] != "cpu":
            return None
        return dict(zip(CPU_MODES, (int(v) for v in parts[1:])))
    except (OSError, ValueError):
        return None


def cpu_percent(prev: dict[str, int] | None, curr: dict[str, int] | None) -> float | None:
    if prev is None or curr is None:
        return None
    total_delta = sum(curr.values()) - sum(prev.values())
    if total_delta <= 0:
        return None
    idle_delta = curr["idle"] + curr["iowait"] - prev["idle"] - prev["iowait"]
    return round(100.0 * (1.0 - idle_delta / total_delta), 1)


def cpu_mode_percents(prev: dict[str, int], curr: dict[str, int]) -> dict[str, float]:
    total_delta = sum(curr.values()) - sum(prev.values())
    if total_delta <= 0:
        return {}
    return {
        mode: round(100.0 * (curr[mode] - prev[mode]) / total_delta, 1)
        for mode in ("user", "system", "iowait", "softirq", "steal")
    }


def busy_ticks(prev: dict[str, int], curr: dict[str, int]) -> int:
    return sum(curr[m] - prev[m] for m in CPU_MODES if m not in ("idle", "iowait"))


def read_text(path: str) -> str:
    try:
        with open(path, "rb") as f:
            return f.read().decode(errors="replace")
    except OSError:
        return ""


def cpu_model(cpuinfo: str = "/proc/cpuinfo") -> str | None:
    """Runner CPUs vary a lot in speed, so record which one a shard got."""
    arm: dict[str, str] = {}
    for line in read_text(cpuinfo).splitlines():
        key, _, value = line.partition(":")
        key = key.strip()
        if key == "model name":
            return value.strip()
        # Arm kernels don't report a model name, only implementer and part ids.
        if key in ("CPU implementer", "CPU part"):
            arm.setdefault(key, value.strip())
    if arm:
        return f"arm implementer={arm.get('CPU implementer')} part={arm.get('CPU part')}"
    return None


def read_proc_stat(pid: str) -> tuple[str, int, int, int] | None:
    """Returns (comm, cpu ticks, reaped children's cpu ticks, start time) for a pid."""
    data = read_text(f"/proc/{pid}/stat")
    if ")" not in data:
        return None
    comm = data[data.index("(") + 1 : data.rindex(")")]
    fields = data[data.rindex(")") + 2 :].split()
    try:
        return (
            comm,
            int(fields[11]) + int(fields[12]),
            int(fields[13]) + int(fields[14]),
            int(fields[19]),
        )
    except (IndexError, ValueError):
        return None


def read_cgroup_cpu_s(cgroup: str) -> float | None:
    for line in read_text(f"/sys/fs/cgroup{cgroup}/cpu.stat").splitlines():
        key, _, value = line.partition(" ")
        if key == "usage_usec":
            return int(value) / 1e6
    return None


def docker_container_names() -> dict[str, str]:
    try:
        r = subprocess.run(
            ["docker", "ps", "-a", "--no-trunc", "--format", "{{.ID}} {{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {}
    return dict(line.split(" ", 1) for line in r.stdout.splitlines() if " " in line)


def classify_process(cmdline: str, comm: str) -> str:
    if not cmdline:
        return "kernel"
    if XDIST_WORKER_MARKER in cmdline:
        return "pytest:worker"
    if "pytest" in cmdline:
        return "pytest:main"
    if "monitor-resources.py" in cmdline:
        return "monitor"
    return comm


class ProcessCpuTracker:
    """Attributes CPU between samples to process groups.

    Live processes are attributed by their own counters. CPU of processes that
    exited between samples is recovered from their cgroup's cpu.stat and
    reported as `exited:<cgroup>`.
    """

    def __init__(self) -> None:
        self.prev: dict[tuple[str, int], tuple[int, int]] = {}
        self.labels: dict[tuple[str, int], str] = {}
        self.cgroups: dict[tuple[str, int], str] = {}
        self.cgroup_cpu_s: dict[str, float] = {}
        self.containers: dict[str, str] = {}
        self.containers_refreshed = float("-inf")
        self.primed = False

    def container_name(self, container_id: str) -> str | None:
        name = self.containers.get(container_id)
        if name is None and time.monotonic() - self.containers_refreshed > CONTAINER_REFRESH_S:
            self.containers = docker_container_names()
            self.containers_refreshed = time.monotonic()
            name = self.containers.get(container_id)
        return name

    def cgroup_label(self, cgroup: str) -> tuple[str, bool]:
        """Returns (label, final). Unresolved container ids are retried later."""
        if m := DOCKER_ID_RE.search(cgroup):
            name = self.container_name(m.group(1))
            return f"docker:{name or m.group(1)[:12]}", name is not None
        return cgroup, True

    def label(self, key: tuple[str, int], comm: str) -> str:
        if (label := self.labels.get(key)) is not None:
            return label
        label, final = self.cgroup_label(self.cgroups[key])
        if not label.startswith("docker:"):
            cmdline = read_text(f"/proc/{key[0]}/cmdline").replace("\0", " ").strip()
            label = classify_process(cmdline, comm)
        if final:
            self.labels[key] = label
        return label

    def sample(self) -> tuple[dict[str, float], dict[str, float]]:
        """Returns CPU-seconds since the previous call, by group and by the
        group of the parent that reaped the children."""
        current: dict[tuple[str, int], tuple[int, int]] = {}
        by_group: dict[str, float] = {}
        children: dict[str, float] = {}
        live_by_cgroup: dict[str, float] = {}
        for pid in os.listdir("/proc"):
            if not pid.isdigit() or (stat := read_proc_stat(pid)) is None:
                continue
            comm, ticks, child_ticks, start = stat
            key = (pid, start)
            current[key] = (ticks, child_ticks)
            if key not in self.cgroups:
                self.cgroups[key] = read_text(f"/proc/{pid}/cgroup").partition("::")[2].strip()
            if not self.primed:
                continue
            prev_ticks, prev_child_ticks = self.prev.get(key, (0, child_ticks))
            delta = (ticks - prev_ticks) / CLK_TCK
            child_delta = (child_ticks - prev_child_ticks) / CLK_TCK
            if delta <= 0 and child_delta <= 0:
                continue
            label = self.label(key, comm)
            if delta > 0:
                by_group[label] = by_group.get(label, 0.0) + delta
                cgroup = self.cgroups[key]
                live_by_cgroup[cgroup] = live_by_cgroup.get(cgroup, 0.0) + delta
            if child_delta > 0:
                children[label] = children.get(label, 0.0) + child_delta

        cgroups = {cg for k, cg in self.cgroups.items() if k in current} | set(self.cgroup_cpu_s)
        # A parent's cpu.stat includes its children; only leaves are exact.
        leaves = {
            cg
            for cg in cgroups
            if cg not in ("", "/") and not any(o.startswith(cg + "/") for o in cgroups)
        }
        cgroup_cpu_s: dict[str, float] = {}
        for cg in leaves:
            if (usage := read_cgroup_cpu_s(cg)) is None:
                continue
            cgroup_cpu_s[cg] = usage
            if (prev_usage := self.cgroup_cpu_s.get(cg)) is not None:
                exited = usage - prev_usage - live_by_cgroup.get(cg, 0.0)
                if exited > 0.01:
                    group = f"exited:{self.cgroup_label(cg)[0]}"
                    by_group[group] = by_group.get(group, 0.0) + exited

        self.labels = {k: v for k, v in self.labels.items() if k in current}
        self.cgroups = {k: v for k, v in self.cgroups.items() if k in current}
        self.prev = current
        self.cgroup_cpu_s = cgroup_cpu_s
        self.primed = True
        return by_group, children


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
    """Parses the `some` line of a PSI file. The `full` line is ignored."""
    try:
        with open(path) as f:
            for line in f:
                kind, *tokens = line.split()
                if kind == "some":
                    return {k: float(v) for k, v in (t.split("=", 1) for t in tokens)}
    except (OSError, ValueError):
        pass
    return None


def sample(
    prev_cpu: dict[str, int] | None, tracker: ProcessCpuTracker | None = None
) -> tuple[dict, dict[str, int] | None]:
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
    if prev_cpu is not None and curr_cpu is not None:
        entry["cpu_modes_pct"] = cpu_mode_percents(prev_cpu, curr_cpu)
        if tracker is not None:
            groups, children = tracker.sample()
            unattributed = busy_ticks(prev_cpu, curr_cpu) / CLK_TCK - sum(groups.values())
            if unattributed > 0:
                groups["unattributed"] = unattributed
            # CPU-seconds per group since the previous sample.
            entry["cpu_s_by_group"] = rounded_by_value(groups)
            # CPU-seconds of exited children, by the group of the parent that reaped them.
            # Overlaps cpu_s_by_group for children that were alive at an earlier sample.
            entry["children_cpu_s_by_parent"] = rounded_by_value(children)
    return entry, curr_cpu


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, int(pct / 100.0 * len(ordered)))
    return ordered[idx]


def rounded_by_value(d: dict[str, float]) -> dict[str, float]:
    return {k: round(v, 2) for k, v in sorted(d.items(), key=lambda kv: -kv[1]) if v >= 0.005}


def cpu_s_by_group(samples: list[dict]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for s in samples:
        for group, cpu_s in s.get("cpu_s_by_group", {}).items():
            totals[group] = totals.get(group, 0.0) + cpu_s
    return {k: round(v, 1) for k, v in sorted(totals.items(), key=lambda kv: -kv[1])}


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
        "cpu_s_by_group": cpu_s_by_group(samples),
        # Samples where xdist workers used CPU, i.e. the test run itself.
        "cpu_s_by_group_during_tests": cpu_s_by_group(
            [s for s in samples if "pytest:worker" in s.get("cpu_s_by_group", {})]
        ),
        "headroom": {
            "cpu": cpu_verdict,
            "memory": mem_verdict,
            "one_more_worker": overall,
        },
    }
    return summary


def run_sampler(output: Path, interval: float) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    tracker = ProcessCpuTracker()
    tracker.sample()
    prev_cpu = read_cpu_times()
    with open(output, "a") as f:
        while not STOP_FILE.exists():
            time.sleep(interval)
            entry, prev_cpu = sample(prev_cpu, tracker)
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
    summary["cpu_model"] = cpu_model()
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
        f"verdict={summary['headroom']['one_more_worker']} "
        f"cpu_model={summary['cpu_model']}"
    )
    print(line)
    top = list(summary["cpu_s_by_group_during_tests"].items())[:10]
    print("cpu-seconds during tests: " + ", ".join(f"{k}={v}" for k, v in top))
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
