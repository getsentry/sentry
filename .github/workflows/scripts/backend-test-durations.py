#!/usr/bin/env python3
"""Per-file test durations, which the shard planners use to size and balance shards.

Each suite checks in its own file, because their per-test costs differ by
more than 10x:

| Suite      | Workflow         | Artifacts                     | Checked-in file                  |
| ---------- | ---------------- | ----------------------------- | -------------------------------- |
| backend    | `backend.yml`    | `backend-test-durations-*`    | `backend-test-durations.json`    |
| acceptance | `acceptance.yml` | `acceptance-test-durations-*` | `acceptance-test-durations.json` |

Every full run of a suite uploads each shard's durations as an artifact. A
file's time can vary by 2x between runs, depending on which runner CPU its
shard got, so refresh a suite's file from several recent green full master
runs of its workflow and keep each file's median. For backend:

    for run in RUN_ID ...; do
        gh run download "$run" --repo getsentry/sentry \\
            --pattern 'backend-test-durations-*' --dir "/tmp/durations/$run"
        python3 .github/workflows/scripts/backend-test-durations.py merge \\
            "/tmp/durations/$run.json" "/tmp/durations/$run"/*/*.json
    done
    python3 .github/workflows/scripts/backend-test-durations.py median \\
        .github/workflows/scripts/backend-test-durations.json /tmp/durations/*.json

For acceptance, use the acceptance artifact pattern and file instead.

The files set how evenly shards are balanced, and the backend file also sets
how many shards a selective backend run gets. They never change which tests
run.
"""

from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import TypedDict


class ShardDurations(TypedDict):
    files: dict[str, float]
    tests: int


class RunDurations(TypedDict):
    seconds_per_test: float
    files: dict[str, float]


def extract(pytest_json: Path) -> ShardDurations:
    """Sum setup, call and teardown time per file from a pytest-json-report file."""
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for test in json.loads(pytest_json.read_text()).get("tests", []):
        tests += 1
        path = test["nodeid"].split("::", 1)[0]
        for stage in ("setup", "call", "teardown"):
            files[path] += test.get(stage, {}).get("duration", 0.0)
    return {"files": dict(files), "tests": tests}


def merge(shards: list[ShardDurations]) -> RunDurations:
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for shard in shards:
        tests += shard["tests"]
        for path, seconds in shard["files"].items():
            files[path] += seconds
    total = sum(files.values())
    return {
        # For files added since: their AST test count times this.
        "seconds_per_test": round(total / tests, 3) if tests else 0.0,
        "files": {path: round(files[path], 1) for path in sorted(files)},
    }


def median(runs: list[RunDurations]) -> RunDurations:
    """Each file's median across merged runs, ignoring runs that didn't run it."""
    files: dict[str, list[float]] = defaultdict(list)
    for run in runs:
        for path, seconds in run["files"].items():
            files[path].append(seconds)
    per_test = statistics.median(run["seconds_per_test"] for run in runs)
    return {
        "seconds_per_test": round(per_test, 3),
        "files": {path: round(statistics.median(files[path]), 1) for path in sorted(files)},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("extract", help="one shard's pytest.json -> its durations")
    p.add_argument("pytest_json", type=Path)
    p.add_argument("output", type=Path)
    p = sub.add_parser("merge", help="every shard's durations -> the checked-in file")
    p.add_argument("output", type=Path)
    p.add_argument("inputs", type=Path, nargs="+")
    p = sub.add_parser("median", help="several runs' merged files -> per-file medians")
    p.add_argument("output", type=Path)
    p.add_argument("inputs", type=Path, nargs="+")
    args = parser.parse_args()

    if args.command == "extract":
        result: ShardDurations | RunDurations = extract(args.pytest_json)
    elif args.command == "merge":
        shards: list[ShardDurations] = [json.loads(path.read_text()) for path in args.inputs]
        result = merge(shards)
    else:
        runs: list[RunDurations] = [json.loads(path.read_text()) for path in args.inputs]
        result = median(runs)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
