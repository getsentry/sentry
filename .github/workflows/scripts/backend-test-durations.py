#!/usr/bin/env python3
"""Per-file test durations, which pytest-selected.py uses to plan full-run shards.

Every full backend run uploads each shard's durations as a
`backend-test-durations-*` artifact. To refresh the checked-in file from a
recent green master run:

    gh run download RUN_ID --repo getsentry/sentry \\
        --pattern 'backend-test-durations-*' --dir /tmp/durations
    python3 .github/workflows/scripts/backend-test-durations.py merge \\
        .github/workflows/scripts/backend-test-durations.json /tmp/durations/*/*.json

The file only affects how evenly shards are balanced, never which tests run.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import defaultdict
from collections.abc import Mapping
from pathlib import Path
from typing import Any

SCHEMA = 1
# Every shard of one attempt of one run must agree on these.
RUN_FIELDS = ("schema", "unit", "commit", "run_id", "run_attempt", "shards")


def extract(pytest_json: Path, env: Mapping[str, str] | None = None) -> dict[str, Any]:
    """Sum setup, call and teardown time per file from a pytest-json-report file.

    Subtests (`subtests` in the report) ran inside the parent's call, so the
    call duration already includes them. Reruns are left out.
    """
    if env is None:
        env = os.environ
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for test in json.loads(pytest_json.read_text()).get("tests", []):
        tests += 1
        path = test["nodeid"].split("::", 1)[0]
        for stage in ("setup", "call", "teardown"):
            files[path] += test.get(stage, {}).get("duration", 0.0)
    return {
        "schema": SCHEMA,
        "unit": "seconds",
        "commit": env.get("GITHUB_SHA"),
        "run_id": env.get("GITHUB_RUN_ID"),
        "run_attempt": env.get("GITHUB_RUN_ATTEMPT"),
        "shard": int(env.get("TEST_GROUP", 0)),
        "shards": int(env.get("TOTAL_TEST_GROUPS", 1)),
        "files": dict(files),
        "tests": tests,
    }


def validate(shards: list[dict[str, Any]]) -> None:
    """Reject inputs that would skew the weights: mixed runs, gaps, bad numbers."""
    if not shards:
        raise ValueError("no shard durations given")
    for shard in shards:
        if shard.get("schema") != SCHEMA or shard.get("unit") != "seconds":
            raise ValueError(f"unsupported durations format: {shard.get('schema')!r}")
    runs = {tuple(shard.get(field) for field in RUN_FIELDS) for shard in shards}
    if len(runs) > 1:
        raise ValueError(f"durations come from more than one run: {sorted(map(str, runs))}")
    (run,) = runs
    if None in run:
        raise ValueError(f"durations are missing run details: {dict(zip(RUN_FIELDS, run))}")
    indexes = sorted(shard["shard"] for shard in shards)
    if indexes != list(range(shards[0]["shards"])):
        raise ValueError(f"expected shards 0..{shards[0]['shards'] - 1} once each, got {indexes}")
    for shard in shards:
        values = [*shard["files"].values(), shard["tests"]]
        if not all(isinstance(v, (int, float)) and math.isfinite(v) and v >= 0 for v in values):
            raise ValueError(f"shard {shard['shard']} has a negative or non-finite duration")


def merge(shards: list[dict[str, Any]]) -> dict[str, Any]:
    validate(shards)
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for shard in shards:
        tests += shard["tests"]
        for path, seconds in shard["files"].items():
            files[path] += seconds
    total = sum(files.values())
    first = shards[0]
    return {
        "source": {field: first[field] for field in ("commit", "run_id", "run_attempt", "shards")},
        # For files added since: their AST test count times this.
        "seconds_per_test": round(total / tests, 3) if tests else 0.0,
        "files": {path: round(files[path], 1) for path in sorted(files)},
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
    args = parser.parse_args()

    if args.command == "extract":
        result = extract(args.pytest_json)
    else:
        result = merge([json.loads(path.read_text()) for path in args.inputs])
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
