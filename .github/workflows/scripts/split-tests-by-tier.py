#!/usr/bin/env python3
"""Split backend tests into tiers based on a service classification report.

Reads classification JSON (from service_classifier pytest plugin) and outputs
test identifier lists for each tier.

Granularity (--granularity):
  file:  Entire file → assigned by heaviest service in file.
  class: file::class → assigned by heaviest service in class.
  test:  Each test independently classified.

Tiers:
  tier1: Postgres + Redis only (migrations mode).
  tier2: Snuba/Kafka only (backend-ci mode, per-worker Snuba).
  tier3: Heavy services — symbolicator/objectstore/bigtable (full backend-ci, -n 2).

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt
    python split-tests-by-tier.py --classification report.json --summary
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

# Files forced to specific tiers due to environment-dependent behavior.
FORCE_TIER3_FILES: set[str] = {
    # Uploads to objectstore (GCS) but lacks requires_objectstore marker;
    # classifier misses the dependency, causing 500s in lighter tiers.
    "tests/sentry/preprod/api/endpoints/test_preprod_artifact_snapshot.py",
}

FORCE_TIER2_FILES: set[str] = {
    "tests/sentry/testutils/thread_leaks/test_pytest.py",
}

# Services that require the heavy tier3 stack.
TIER3_SERVICES: set[str] = {"symbolicator", "objectstore", "bigtable"}

# Path prefixes routed to tier3 regardless of service classification.
# relay_integration tests are individually slow (12-18s each) and cause
# shard imbalance if left in tier2.
TIER3_PATH_PREFIXES: tuple[str, ...] = ("tests/relay_integration/",)

# Services that require tier2 (Snuba stack) but not tier3.
TIER2_SERVICES: set[str] = {"snuba", "kafka"}


def _scope_key(test_id: str, granularity: str) -> str:
    if granularity == "file":
        return test_id.split("::")[0]
    elif granularity == "class":
        return "::".join(test_id.split("::")[:2])
    return test_id


def split(classification: dict, granularity: str = "file") -> dict[str, set[str]]:
    scope_services: dict[str, set[str]] = defaultdict(set)
    for test_id, services in classification.get("tests", {}).items():
        scope = _scope_key(test_id, granularity)
        if isinstance(services, list):
            scope_services[scope].update(services)
        else:
            scope_services[scope].add(services)

    tier1: set[str] = set()
    tier2: set[str] = set()
    tier3: set[str] = set()
    for scope, services in scope_services.items():
        file_path = scope.split("::")[0]
        is_tier3_path = any(file_path.startswith(p) for p in TIER3_PATH_PREFIXES)
        if file_path in FORCE_TIER3_FILES or is_tier3_path or (services & TIER3_SERVICES):
            tier3.add(scope)
        elif file_path in FORCE_TIER2_FILES or (services & TIER2_SERVICES):
            tier2.add(scope)
        else:
            tier1.add(scope)

    return {"tier1": tier1, "tier2": tier2, "tier3": tier3}


def main() -> int:
    parser = argparse.ArgumentParser(description="Split tests into tiers")
    parser.add_argument("--classification", required=True)
    parser.add_argument("--tier", choices=["tier1", "tier2", "tier3"])
    parser.add_argument("--output", help="Output file (default: stdout)")
    parser.add_argument("--granularity", choices=["file", "class", "test"], default="file")
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()

    with open(args.classification) as f:
        classification = json.load(f)

    tiers = split(classification, granularity=args.granularity)

    if args.summary:
        total = len(tiers["tier1"]) + len(tiers["tier2"]) + len(tiers["tier3"])
        label = {"file": "files", "class": "scopes", "test": "tests"}[args.granularity]
        print(f"Granularity: {args.granularity}")
        print(f"Total {label}: {total}")
        print(f"Tier 1 (Postgres + Redis):  {len(tiers['tier1'])} {label} ({len(tiers['tier1']) / total * 100:.1f}%)")
        print(f"Tier 2 (Snuba/Kafka):       {len(tiers['tier2'])} {label} ({len(tiers['tier2']) / total * 100:.1f}%)")
        print(f"Tier 3 (heavy):             {len(tiers['tier3'])} {label} ({len(tiers['tier3']) / total * 100:.1f}%)")

        tests_data = classification.get("tests", {})
        counts = {"tier1": 0, "tier2": 0, "tier3": 0}
        for test_id in tests_data:
            scope = _scope_key(test_id, args.granularity)
            for tier_name, tier_scopes in tiers.items():
                if scope in tier_scopes:
                    counts[tier_name] += 1
                    break
        print(f"\nTier 1 tests: {counts['tier1']}")
        print(f"Tier 2 tests: {counts['tier2']}")
        print(f"Tier 3 tests: {counts['tier3']}")
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
