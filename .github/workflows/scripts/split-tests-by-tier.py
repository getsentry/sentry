#!/usr/bin/env python3
"""Split backend tests into tiers based on a service classification report.

Reads classification JSON (from service_classifier pytest plugin) and outputs
test identifier lists for each tier.

Granularity (--granularity):
  file:  Entire file → assigned to highest tier any test needs.
  class: file::class → assigned to highest tier any test in class needs.
  test:  Each test independently classified.

Tiers:
  tier1: Postgres + Redis only (migrations mode).
  tier2: Full Snuba stack (backend-ci mode).

Sharding (--shards N --output-dir DIR):
  When --shards is specified, the selected tier's scopes are split into N
  balanced shards using a greedy LPT (Longest Processing Time) algorithm,
  using test count per scope as a proxy for duration. Each shard is written
  to {output-dir}/shard-{i}.txt. Without --shards, a single file is written
  to --output (or stdout).

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt
    python split-tests-by-tier.py --classification report.json --summary
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 17 --output-dir /tmp/tier2-shards/
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

# Files forced to tier2 due to environment-dependent behavior.
FORCE_TIER2_FILES: set[str] = {
    "tests/sentry/testutils/thread_leaks/test_pytest.py",
    # Uploads to objectstore (GCS) but lacks requires_objectstore marker;
    # classifier misses the dependency, causing 500s in tier1.
    "tests/sentry/preprod/api/endpoints/test_preprod_artifact_snapshot.py",
}

# Services that require tier2 (full Snuba stack).
TIER2_SERVICES: set[str] = {"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}


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
    for scope, services in scope_services.items():
        file_path = scope.split("::")[0]
        if file_path in FORCE_TIER2_FILES or (services & TIER2_SERVICES):
            tier2.add(scope)
        else:
            tier1.add(scope)

    return {"tier1": tier1, "tier2": tier2}


def _count_tests_per_scope(
    classification: dict, scopes: set[str], granularity: str
) -> dict[str, int]:
    """Count the number of tests in each scope for LPT weight estimation."""
    counts: dict[str, int] = defaultdict(int)
    for test_id in classification.get("tests", {}):
        scope = _scope_key(test_id, granularity)
        if scope in scopes:
            counts[scope] += 1
    return counts


def lpt_shard(scopes: set[str], n_shards: int, weights: dict[str, int]) -> list[list[str]]:
    """Greedy LPT (Longest Processing Time) assignment of scopes to n_shards.

    Sorts scopes by weight descending, then greedily assigns each to the
    shard with the lowest current total weight. Minimizes the maximum shard
    load (within a 4/3 approximation of optimal).
    """
    sorted_scopes = sorted(scopes, key=lambda s: weights.get(s, 1), reverse=True)
    shard_loads = [0] * n_shards
    shards: list[list[str]] = [[] for _ in range(n_shards)]

    for scope in sorted_scopes:
        min_idx = shard_loads.index(min(shard_loads))
        shards[min_idx].append(scope)
        shard_loads[min_idx] += weights.get(scope, 1)

    # Log shard balance to stderr for visibility in CI.
    total = sum(shard_loads)
    max_load = max(shard_loads)
    min_load = min(shard_loads)
    print(
        f"[lpt] {n_shards} shards: total={total} tests, "
        f"max={max_load}, min={min_load}, spread={max_load - min_load}",
        file=sys.stderr,
    )
    return shards


def main() -> int:
    parser = argparse.ArgumentParser(description="Split tests into tiers")
    parser.add_argument("--classification", required=True)
    parser.add_argument("--tier", choices=["tier1", "tier2"])
    parser.add_argument("--output", help="Output file (default: stdout)")
    parser.add_argument("--granularity", choices=["file", "class", "test"], default="file")
    parser.add_argument("--summary", action="store_true")
    parser.add_argument("--shards", type=int, help="Split tier into N balanced shards (LPT)")
    parser.add_argument(
        "--output-dir", help="Output directory for per-shard files (requires --shards)"
    )
    args = parser.parse_args()

    if args.shards and not args.output_dir:
        print("Error: --output-dir is required when using --shards", file=sys.stderr)
        return 1

    with open(args.classification) as f:
        classification = json.load(f)

    tiers = split(classification, granularity=args.granularity)

    if args.summary:
        total = len(tiers["tier1"]) + len(tiers["tier2"])
        label = {"file": "files", "class": "scopes", "test": "tests"}[args.granularity]
        print(f"Granularity: {args.granularity}")
        print(f"Total {label}: {total}")
        print(
            f"Tier 1 (Postgres + Redis):  {len(tiers['tier1'])} {label} ({len(tiers['tier1']) / total * 100:.1f}%)"
        )
        print(
            f"Tier 2 (Full Snuba stack):  {len(tiers['tier2'])} {label} ({len(tiers['tier2']) / total * 100:.1f}%)"
        )

        tests_data = classification.get("tests", {})
        counts = {"tier1": 0, "tier2": 0}
        for test_id in tests_data:
            scope = _scope_key(test_id, args.granularity)
            for tier_name, tier_scopes in tiers.items():
                if scope in tier_scopes:
                    counts[tier_name] += 1
                    break
        print(f"\nTier 1 tests: {counts['tier1']}")
        print(f"Tier 2 tests: {counts['tier2']}")
        return 0

    if not args.tier:
        print("Error: --tier is required unless --summary is used", file=sys.stderr)
        return 1

    scopes = tiers[args.tier]

    if args.shards:
        weights = _count_tests_per_scope(classification, scopes, args.granularity)
        shards = lpt_shard(scopes, args.shards, weights)
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, shard_scopes in enumerate(shards):
            shard_file = out_dir / f"shard-{i}.txt"
            shard_file.write_text("\n".join(sorted(shard_scopes)) + "\n")
            print(
                f"Shard {i}: {len(shard_scopes)} scopes → {shard_file}",
                file=sys.stderr,
            )
        return 0

    scopes_sorted = sorted(scopes)
    if args.output:
        Path(args.output).write_text("\n".join(scopes_sorted) + "\n")
        print(
            f"Wrote {len(scopes_sorted)} {args.granularity}-level identifiers to {args.output}",
            file=sys.stderr,
        )
    else:
        for s in scopes_sorted:
            print(s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
