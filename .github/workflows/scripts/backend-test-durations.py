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
from collections import defaultdict
from pathlib import Path


def extract(pytest_json: Path) -> dict[str, object]:
    """Sum setup, call and teardown time per file from a pytest-json-report file."""
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for test in json.loads(pytest_json.read_text()).get("tests", []):
        tests += 1
        path = test["nodeid"].split("::", 1)[0]
        for stage in ("setup", "call", "teardown"):
            files[path] += test.get(stage, {}).get("duration", 0.0)
    return {"files": dict(files), "tests": tests}


def merge(shards: list[dict[str, object]]) -> dict[str, object]:
    files: dict[str, float] = defaultdict(float)
    tests = 0
    for shard in shards:
        tests += shard["tests"]  # type: ignore[operator]
        for path, seconds in shard["files"].items():  # type: ignore[attr-defined]
            files[path] += seconds
    total = sum(files.values())
    return {
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
