#!/usr/bin/env python3
"""Merge pytest JSON reports into a scope-level test durations file.

Reads one or more pytest JSON report files (from --json-report) and outputs
a single JSON file mapping test scopes to their total duration in seconds.

Scopes are "file::class" (or just "file" for module-level tests), matching
the grouping used by --dist=loadfile and our sharding logic.

Usage:
    python merge-test-durations.py \
        --input-dir /tmp/reports/ \
        --output /tmp/test-durations.json

Input: directory containing pytest JSON report files (*.json)
Output: JSON file like {"tests/foo/test_bar.py::TestClass": 12.5, ...}
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def extract_durations(report_path: Path) -> dict[str, float]:
    """Extract per-scope durations from a single pytest JSON report."""
    with report_path.open() as f:
        data = json.load(f)

    scope_durations: dict[str, float] = defaultdict(float)

    for test in data.get("tests", []):
        nodeid = test.get("nodeid", "")
        duration = test.get("duration", 0.0)

        if not nodeid or duration <= 0:
            continue

        # Scope = everything except the test function name
        # e.g. "tests/foo/test_bar.py::TestClass::test_method" -> "tests/foo/test_bar.py::TestClass"
        scope = nodeid.rsplit("::", 1)[0]
        scope_durations[scope] += duration

    return dict(scope_durations)


def merge_durations(all_durations: list[dict[str, float]]) -> dict[str, float]:
    """Merge multiple duration dicts, averaging durations for scopes seen multiple times."""
    scope_totals: dict[str, float] = defaultdict(float)
    scope_counts: dict[str, int] = defaultdict(int)

    for durations in all_durations:
        for scope, dur in durations.items():
            scope_totals[scope] += dur
            scope_counts[scope] += 1

    # Average across runs for stability
    return {scope: scope_totals[scope] / scope_counts[scope] for scope in scope_totals}


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
                    print(f"  {report_file.name}: {len(durations)} scopes, {sum(durations.values()):.1f}s total")
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
        print(f"\nMerged: {len(merged)} scopes from {len(report_files)} reports")
        print(f"Total duration: {total_dur:.1f}s ({total_dur/60:.1f}m)")
        print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
