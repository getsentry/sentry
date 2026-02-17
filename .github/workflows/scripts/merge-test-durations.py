#!/usr/bin/env python3
"""Merge pytest JSON reports into a per-test durations file.

Reads pytest JSON report files and outputs a JSON file mapping full test
nodeids to their *call* duration in seconds.

Only the ``call`` phase is used (not ``setup`` or ``teardown``) to avoid
contamination from the H1 overlapped-startup pattern, where the session-
scoped ``_requires_snuba`` fixture blocks for ~100-150s and inflates the
first test's setup time on each xdist worker.

Individual test durations are capped at MAX_CALL_DURATION to further
remove outliers (e.g. tests that happened to run during GC pauses or
infrastructure hiccups).

Usage:
    python merge-test-durations.py \
        --input-dir /tmp/reports/ \
        --output /tmp/test-durations.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

MAX_CALL_DURATION = 60.0  # cap any single test at 60s


def extract_durations(report_path: Path) -> dict[str, float]:
    """Extract per-test *call* durations from a single pytest JSON report."""
    with report_path.open() as f:
        data = json.load(f)

    test_durations: dict[str, float] = {}

    for test in data.get("tests", []):
        nodeid = test.get("nodeid", "")
        if not nodeid:
            continue

        # Prefer call-phase duration to avoid H1 setup contamination.
        call_info = test.get("call", {})
        dur = call_info.get("duration", 0.0) if isinstance(call_info, dict) else 0.0

        # Fallback: top-level duration minus setup/teardown
        if dur <= 0:
            dur = test.get("duration", 0.0)

        if dur <= 0:
            continue

        # Cap to remove outliers
        dur = min(dur, MAX_CALL_DURATION)
        test_durations[nodeid] = dur

    return test_durations


def merge_durations(all_durations: list[dict[str, float]]) -> dict[str, float]:
    """Merge multiple duration dicts, using median for tests seen multiple times."""
    test_values: dict[str, list[float]] = defaultdict(list)

    for durations in all_durations:
        for nodeid, dur in durations.items():
            test_values[nodeid].append(dur)

    # Use median for stability (outlier-resistant)
    merged: dict[str, float] = {}
    for nodeid, values in test_values.items():
        values.sort()
        mid = len(values) // 2
        merged[nodeid] = values[mid] if len(values) % 2 else (values[mid - 1] + values[mid]) / 2

    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge pytest JSON reports into test durations file")
    parser.add_argument("--input-dir", required=True, help="Directory containing pytest JSON reports")
    parser.add_argument("--output", required=True, help="Output durations JSON file")
    parser.add_argument("--summary", action="store_true", help="Print summary statistics")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        print(f"ERROR: Input directory {input_dir} does not exist", file=sys.stderr)
        return 1

    report_files = sorted(input_dir.glob("**/*.json"))
    if not report_files:
        print(f"ERROR: No JSON files found in {input_dir}", file=sys.stderr)
        return 1

    all_durations: list[dict[str, float]] = []
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
        print("WARNING: No valid duration data found — writing empty file", file=sys.stderr)
        Path(args.output).write_text("{}\n")
        return 0

    merged = merge_durations(all_durations)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        json.dump(merged, f, sort_keys=True)

    if args.summary:
        total_dur = sum(merged.values())
        avg_dur = total_dur / len(merged) if merged else 0
        print(f"\nMerged: {len(merged)} tests from {len(report_files)} reports")
        print(f"Total duration: {total_dur:.1f}s ({total_dur / 60:.1f}m)")
        print(f"Average per test: {avg_dur:.2f}s")
        print(f"Output: {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
