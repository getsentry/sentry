#!/usr/bin/env python3
"""Merge pytest JSON reports into a per-test durations file.

Reads one or more pytest JSON report files (from --json-report) and outputs
a single JSON file mapping full test nodeids to their duration in seconds.

Per-test granularity allows the LPT shard allocator to distribute individual
tests across shards, avoiding the bottleneck where mega-scopes (e.g. a single
test class with 600s+ of tests) get pinned to one shard.

Usage:
    python merge-test-durations.py \
        --input-dir /tmp/reports/ \
        --output /tmp/test-durations.json

Input: directory containing pytest JSON report files (*.json)
Output: JSON file like {"tests/foo/test_bar.py::TestClass::test_method": 1.5, ...}
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def extract_durations(report_path: Path) -> dict[str, float]:
    """Extract per-test durations from a single pytest JSON report."""
    with report_path.open() as f:
        data = json.load(f)

    test_durations: dict[str, float] = {}

    for test in data.get("tests", []):
        nodeid = test.get("nodeid", "")

        # Duration can be at top level or split across setup/call/teardown phases
        duration = test.get("duration", 0.0)
        if not duration:
            duration = sum(
                test.get(phase, {}).get("duration", 0.0)
                for phase in ("setup", "call", "teardown")
            )

        if not nodeid or duration <= 0:
            continue

        test_durations[nodeid] = duration

    return test_durations


def merge_durations(all_durations: list[dict[str, float]]) -> dict[str, float]:
    """Merge multiple duration dicts, averaging durations for tests seen multiple times."""
    test_totals: dict[str, float] = defaultdict(float)
    test_counts: dict[str, int] = defaultdict(int)

    for durations in all_durations:
        for nodeid, dur in durations.items():
            test_totals[nodeid] += dur
            test_counts[nodeid] += 1

    # Average across runs for stability
    return {nodeid: test_totals[nodeid] / test_counts[nodeid] for nodeid in test_totals}


def main():
    parser = argparse.ArgumentParser(description="Merge pytest JSON reports into test durations file")
    parser.add_argument("--input-dir", required=True, help="Directory containing pytest JSON reports")
    parser.add_argument("--output", required=True, help="Output durations JSON file")
    parser.add_argument("--summary", action="store_true", help="Print summary statistics")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        print(f"ERROR: Input directory {input_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    report_files = sorted(input_dir.glob("**/*.json"))
    if not report_files:
        print(f"ERROR: No JSON files found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    all_durations = []
    for report_file in report_files:
        try:
            durations = extract_durations(report_file)
            if durations:
                all_durations.append(durations)
                if args.summary:
                    print(f"  {report_file.name}: {len(durations)} tests, {sum(durations.values()):.1f}s total")
        except (json.JSONDecodeError, KeyError) as e:
            print(f"WARNING: Skipping {report_file}: {e}", file=sys.stderr)

    if not all_durations:
        print("ERROR: No valid duration data found", file=sys.stderr)
        sys.exit(1)

    merged = merge_durations(all_durations)

    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        json.dump(merged, f, indent=2, sort_keys=True)

    if args.summary:
        total_dur = sum(merged.values())
        print(f"\nMerged: {len(merged)} tests from {len(report_files)} reports")
        print(f"Total duration: {total_dur:.1f}s ({total_dur/60:.1f}m)")
        print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
