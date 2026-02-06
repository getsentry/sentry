#!/usr/bin/env python3
"""
Split backend tests into tiers based on a service classification report.

Reads a classification JSON (from the service_classifier pytest plugin)
and outputs test file lists for each tier.

Tier 1: Tests that do NOT need Snuba (Postgres + Redis only)
Tier 2: Tests that DO need Snuba (full backend-ci stack)

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1-tests.txt
    python split-tests-by-tier.py --classification report.json --tier tier2 --output tier2-tests.txt
    python split-tests-by-tier.py --classification report.json --summary
"""

from __future__ import annotations

import argparse
import json  # noqa: S003
import sys
from collections import defaultdict
from pathlib import Path


def load_classification(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def get_test_files_by_tier(classification: dict) -> dict[str, set[str]]:
    """
    Group test files into tiers based on their service dependencies.

    A file is assigned to the HIGHEST tier any of its tests require.
    If any test in a file needs Snuba, the whole file goes to tier2.
    """
    file_services: dict[str, set[str]] = defaultdict(set)

    for test_id, services in classification.get("tests", {}).items():
        # Extract file path from test node ID (e.g., "tests/foo/test_bar.py::Class::method")
        file_path = test_id.split("::")[0]
        if isinstance(services, list):
            file_services[file_path].update(services)
        else:
            file_services[file_path].add(services)

    tier1_files: set[str] = set()
    tier2_files: set[str] = set()

    for file_path, services in file_services.items():
        if "snuba" in services:
            tier2_files.add(file_path)
        else:
            tier1_files.add(file_path)

    return {"tier1": tier1_files, "tier2": tier2_files}


def main() -> int:
    parser = argparse.ArgumentParser(description="Split tests into tiers")
    parser.add_argument(
        "--classification",
        required=True,
        help="Path to test-service-classification.json",
    )
    parser.add_argument(
        "--tier",
        choices=["tier1", "tier2"],
        help="Which tier's test files to output",
    )
    parser.add_argument(
        "--output",
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print tier summary instead of file list",
    )
    args = parser.parse_args()

    classification = load_classification(args.classification)
    tiers = get_test_files_by_tier(classification)

    if args.summary:
        total_files = len(tiers["tier1"]) + len(tiers["tier2"])
        print(f"Total test files: {total_files}")
        print(f"Tier 1 (Postgres + Redis): {len(tiers['tier1'])} files")
        print(f"Tier 2 (Full Snuba stack): {len(tiers['tier2'])} files")
        print(f"Tier 1 %: {len(tiers['tier1']) / total_files * 100:.1f}%")
        print(f"Tier 2 %: {len(tiers['tier2']) / total_files * 100:.1f}%")

        # Also count tests per tier
        tier1_tests = sum(
            1
            for test_id, services in classification.get("tests", {}).items()
            if test_id.split("::")[0] in tiers["tier1"]
        )
        tier2_tests = sum(
            1
            for test_id, services in classification.get("tests", {}).items()
            if test_id.split("::")[0] in tiers["tier2"]
        )
        print(f"\nTier 1 tests: {tier1_tests}")
        print(f"Tier 2 tests: {tier2_tests}")
        return 0

    if not args.tier:
        print("Error: --tier is required unless --summary is used", file=sys.stderr)
        return 1

    files = sorted(tiers[args.tier])

    if args.output:
        Path(args.output).write_text("\n".join(files) + "\n")
        print(f"Wrote {len(files)} files to {args.output}", file=sys.stderr)
    else:
        for f in files:
            print(f)

    return 0


if __name__ == "__main__":
    sys.exit(main())
