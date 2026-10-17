from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def run_once(args: list[str], cwd: Path) -> tuple[float, float]:
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    start = time.perf_counter()
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", *args],
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    wall = time.perf_counter() - start
    if proc.returncode != 0:
        raise SystemExit(f"benchmark run failed: {args}\n{proc.stdout}")
    return wall, wall


def median_time(args: list[str], cwd: Path, trials: int) -> dict[str, float]:
    walls = []
    for _ in range(trials):
        wall, _ = run_once(args, cwd)
        walls.append(wall)
    return {"median_wall_s": statistics.median(walls), "min_wall_s": min(walls), "max_wall_s": max(walls)}


def write_suite(root: Path, kind: str) -> None:
    if kind == "uniform":
        for idx in range(8):
            (root / f"test_u{idx}.py").write_text(
                "".join(f"def test_{i}():\n assert {i} >= 0\n" for i in range(10))
            )
    elif kind == "uneven":
        (root / "test_big.py").write_text("".join(f"def test_big_{i}():\n assert True\n" for i in range(80)))
        for idx in range(7):
            (root / f"test_s{idx}.py").write_text("def test_small():\n assert True\n")
    elif kind == "many_tiny":
        for idx in range(40):
            (root / f"test_t{idx}.py").write_text("def test_tiny():\n assert True\n")
    elif kind == "single_file":
        (root / "test_one.py").write_text(
            "import pytest\n@pytest.mark.parametrize('i', range(100))\ndef test_p(i):\n assert i >= 0\n"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--workers", type=int, default=4)
    opts = parser.parse_args()
    results: dict[str, object] = {"trials": opts.trials, "workers": opts.workers, "suites": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for kind in ("uniform", "uneven", "many_tiny", "single_file"):
            suite = Path(tmp) / kind
            suite.mkdir()
            write_suite(suite, kind)
            collect = median_time([str(suite), "--collect-only", "-q", "--serial"], suite, opts.trials)
            serial = median_time([str(suite), "-q", "--serial"], suite, opts.trials)
            count = median_time(
                [str(suite), "-q", "-j", str(opts.workers), "--parallel-balance=count"], suite, opts.trials
            )
            rr = median_time(
                [str(suite), "-q", "-j", str(opts.workers), "--parallel-balance=round-robin"], suite, opts.trials
            )
            plan_start = time.perf_counter()
            subprocess.run(
                [sys.executable, "-m", "pytest", str(suite), "-j", str(opts.workers), "--parallel-plan=json", "-q"],
                cwd=suite,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                check=True,
                env={k: v for k, v in os.environ.items() if k != "_PYTEST_PARALLEL_WORKER"},
            )
            plan_wall = time.perf_counter() - plan_start
            results["suites"][kind] = {  # type: ignore[index]
                "collection_only_median_s": collect["median_wall_s"],
                "serial": serial,
                "parallel_count": count,
                "parallel_round_robin": rr,
                "worker_startup_plus_execution_note": "total wall includes collection, worker startup and test execution; "
                "startup overhead is approximated as parallel total minus serial total and is not labelled pure startup",
                "plan_wall_s_single": plan_wall,
            }
    print(json.dumps(results, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
