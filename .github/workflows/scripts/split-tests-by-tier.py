#!/usr/bin/env python3
"""
Split backend tests into tiers based on a service classification report.

Reads a classification JSON (from the service_classifier pytest plugin)
and outputs test identifier lists for each tier.

Supports three granularity levels:
  --granularity file   (default) Group by test file. Entire file → tier2 if any test needs it.
  --granularity class  Group by file::class scope. Mixed files split at class boundary.
  --granularity test   No grouping. Each individual test independently classified.

Tiers:
  tier1:        Tests needing only Postgres + Redis (migrations mode)
  tier2-light:  Tests needing Snuba stack but NOT symbolicator/objectstore/bigtable
  tier2-heavy:  Tests needing symbolicator/objectstore/bigtable, or relay_integration tests

For backward compatibility, "tier2" returns the union of tier2-light and tier2-heavy.

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt
    python split-tests-by-tier.py --classification report.json --tier tier2-light --output t2l.txt
    python split-tests-by-tier.py --classification report.json --tier tier2-heavy --output t2h.txt
    python split-tests-by-tier.py --classification report.json --tier tier2 --output t2.txt  # union
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

# Services that require the full backend-ci stack (not just snuba).
# Tests using these go to tier2-heavy, which runs backend-ci mode
# (includes symbolicator, objectstore, bigtable containers).
HEAVY_SERVICES: set[str] = {"symbolicator", "objectstore", "bigtable"}

# Path prefixes forced to tier2-heavy regardless of service tags.
# relay_integration tests spin up class-scoped relay containers (slow, ~15-20s each)
# and some need symbolicator. Consolidating them in the heavy shard removes slow
# outliers from the light tier2 pool, reducing shard variance.
# symbolicator/ tests always need the symbolicator container.
FORCE_TIER2_HEAVY_PATHS: tuple[str, ...] = (
    "tests/relay_integration/",
    "tests/symbolicator/",
)


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

    Returns dict with keys: tier1, tier2-light, tier2-heavy.
    At the chosen granularity, a scope is assigned to the HIGHEST tier
    any of its tests require.
    """
    scope_services: dict[str, set[str]] = defaultdict(set)

    for test_id, services in classification.get("tests", {}).items():
        scope = _scope_key(test_id, granularity)
        if isinstance(services, list):
            scope_services[scope].update(services)
        else:
            scope_services[scope].add(services)

    # Services that require any tier2 variant (light or heavy)
    tier2_services = {"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}

    tier1_scopes: set[str] = set()
    tier2_light_scopes: set[str] = set()
    tier2_heavy_scopes: set[str] = set()

    for scope, services in scope_services.items():
        file_path = scope.split("::")[0]

        # Check FORCE_TIER2_FILES (go to tier2 — assigned to light or heavy below)
        if file_path in FORCE_TIER2_FILES:
            tier2_light_scopes.add(scope)
        # Check if scope needs tier2 at all
        elif not (services & tier2_services):
            tier1_scopes.add(scope)
        # Tier2: determine light vs heavy
        elif (services & HEAVY_SERVICES) or file_path.startswith(FORCE_TIER2_HEAVY_PATHS):
            tier2_heavy_scopes.add(scope)
        else:
            tier2_light_scopes.add(scope)

    return {
        "tier1": tier1_scopes,
        "tier2-light": tier2_light_scopes,
        "tier2-heavy": tier2_heavy_scopes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Split tests into tiers")
    parser.add_argument(
        "--classification",
        required=True,
        help="Path to test-service-classification.json",
    )
    parser.add_argument(
        "--tier",
        choices=["tier1", "tier2", "tier2-light", "tier2-heavy"],
        help="Which tier's test identifiers to output (tier2 = union of light+heavy)",
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
        total_scopes = len(tiers["tier1"]) + len(tiers["tier2-light"]) + len(tiers["tier2-heavy"])
        label = {"file": "files", "class": "scopes", "test": "tests"}[args.granularity]
        print(f"Granularity: {args.granularity}")
        print(f"Total {label}: {total_scopes}")
        print(f"Tier 1 (Postgres + Redis):       {len(tiers['tier1'])} {label}")
        print(f"Tier 2 Light (Snuba stack):       {len(tiers['tier2-light'])} {label}")
        print(f"Tier 2 Heavy (full backend-ci):   {len(tiers['tier2-heavy'])} {label}")
        t2_total = len(tiers["tier2-light"]) + len(tiers["tier2-heavy"])
        print(f"Tier 2 total:                     {t2_total} {label}")
        print(f"Tier 1 %: {len(tiers['tier1']) / total_scopes * 100:.1f}%")
        print(f"Tier 2 Light %: {len(tiers['tier2-light']) / total_scopes * 100:.1f}%")
        print(f"Tier 2 Heavy %: {len(tiers['tier2-heavy']) / total_scopes * 100:.1f}%")

        # Count individual tests per tier
        tests_data = classification.get("tests", {})
        counts = {"tier1": 0, "tier2-light": 0, "tier2-heavy": 0}
        for test_id in tests_data:
            scope = _scope_key(test_id, args.granularity)
            for tier_name, tier_scopes in tiers.items():
                if scope in tier_scopes:
                    counts[tier_name] += 1
                    break

        print(f"\nTier 1 tests:       {counts['tier1']}")
        print(f"Tier 2 Light tests: {counts['tier2-light']}")
        print(f"Tier 2 Heavy tests: {counts['tier2-heavy']}")
        return 0

    if not args.tier:
        print("Error: --tier is required unless --summary is used", file=sys.stderr)
        return 1

    # "tier2" is the union of light + heavy (backward compatibility)
    if args.tier == "tier2":
        scopes = sorted(tiers["tier2-light"] | tiers["tier2-heavy"])
    else:
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
