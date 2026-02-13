#!/usr/bin/env python3
"""
Split backend tests into tiers based on a service classification report.

Reads a classification JSON (from the service_classifier pytest plugin)
and outputs test identifier lists for each tier.

Supports three granularity levels:
  --granularity file   (default) Group by test file. Entire file → tier2 if any test needs it.
  --granularity class  Group by file::class scope. Mixed files split at class boundary.
  --granularity test   No grouping. Each individual test independently classified.

Tier 1: Tests that do NOT need Snuba (Postgres + Redis only)
Tier 2: Tests that DO need Snuba (full backend-ci stack)

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1-tests.txt
    python split-tests-by-tier.py --classification report.json --tier tier2 --output tier2-tests.txt
    python split-tests-by-tier.py --classification report.json --granularity class --tier tier1 --output tier1-tests.txt
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


# Files forced to Tier 2 due to environment-dependent behavior that only works
# with the full backend-ci service stack. These tests don't use Snuba/Kafka
# directly, but behave differently under the lighter migrations devservices mode.
# See docs/service-classification-investigation.md for details.
FORCE_TIER2_FILES: set[str] = {
    # Thread leak detection tests depend on global sentry_sdk scope state which
    # differs between migrations and backend-ci modes. The tests assert specific
    # event levels (info/error) but get 'warning' in migrations mode due to
    # scope level inheritance from the lighter initialization path.
    "tests/sentry/testutils/thread_leaks/test_pytest.py",
}


def _scope_key(test_id: str, granularity: str) -> str:
    """Extract the grouping key for a test ID at the given granularity.

    - file:  tests/foo/test_bar.py
    - class: tests/foo/test_bar.py::TestClass  (or tests/foo/test_bar.py::test_func)
    - test:  tests/foo/test_bar.py::TestClass::test_method
    """
    if granularity == "file":
        return test_id.split("::")[0]
    elif granularity == "class":
        parts = test_id.split("::")
        return "::".join(parts[:2])  # file::class or file::func
    else:  # test
        return test_id


def get_tests_by_tier(classification: dict, granularity: str = "file") -> dict[str, set[str]]:
    """
    Group tests into tiers based on their service dependencies.

    At the chosen granularity, a scope is assigned to the HIGHEST tier
    any of its tests require. If any test in a scope needs a Tier 2
    service, the whole scope goes to tier2.
    """
    scope_services: dict[str, set[str]] = defaultdict(set)

    for test_id, services in classification.get("tests", {}).items():
        scope = _scope_key(test_id, granularity)
        if isinstance(services, list):
            scope_services[scope].update(services)
        else:
            scope_services[scope].add(services)

    # Services that require the full backend-ci stack (Tier 2)
    tier2_services = {"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}

    tier1_scopes: set[str] = set()
    tier2_scopes: set[str] = set()

    for scope, services in scope_services.items():
        # Check FORCE_TIER2_FILES against the file portion of the scope
        file_path = scope.split("::")[0]
        if file_path in FORCE_TIER2_FILES:
            tier2_scopes.add(scope)
        elif services & tier2_services:
            tier2_scopes.add(scope)
        else:
            tier1_scopes.add(scope)

    return {"tier1": tier1_scopes, "tier2": tier2_scopes}


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
        help="Which tier's test identifiers to output",
    )
    parser.add_argument(
        "--output",
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--granularity",
        choices=["file", "class", "test"],
        default="file",
        help="Grouping granularity: file (default), class, or test",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print tier summary instead of identifier list",
    )
    args = parser.parse_args()

    classification = load_classification(args.classification)
    tiers = get_tests_by_tier(classification, granularity=args.granularity)

    if args.summary:
        total_scopes = len(tiers["tier1"]) + len(tiers["tier2"])
        label = {"file": "files", "class": "scopes", "test": "tests"}[args.granularity]
        print(f"Granularity: {args.granularity}")
        print(f"Total {label}: {total_scopes}")
        print(f"Tier 1 (Postgres + Redis): {len(tiers['tier1'])} {label}")
        print(f"Tier 2 (Full Snuba stack): {len(tiers['tier2'])} {label}")
        print(f"Tier 1 %: {len(tiers['tier1']) / total_scopes * 100:.1f}%")
        print(f"Tier 2 %: {len(tiers['tier2']) / total_scopes * 100:.1f}%")

        # Count individual tests per tier
        tier1_tests = sum(
            1
            for test_id in classification.get("tests", {})
            if _scope_key(test_id, args.granularity) in tiers["tier1"]
        )
        tier2_tests = sum(
            1
            for test_id in classification.get("tests", {})
            if _scope_key(test_id, args.granularity) in tiers["tier2"]
        )
        print(f"\nTier 1 tests: {tier1_tests}")
        print(f"Tier 2 tests: {tier2_tests}")
        return 0

    if not args.tier:
        print("Error: --tier is required unless --summary is used", file=sys.stderr)
        return 1

    scopes = sorted(tiers[args.tier])

    if args.output:
        Path(args.output).write_text("\n".join(scopes) + "\n")
        print(f"Wrote {len(scopes)} {args.granularity}-level identifiers to {args.output}", file=sys.stderr)
    else:
        for s in scopes:
            print(s)

    return 0


if __name__ == "__main__":
    sys.exit(main())
