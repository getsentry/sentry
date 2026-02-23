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
  balanced shards. If --durations is provided, uses worker-simulated LPT
  (Longest Processing Time) which minimises max(worker wallclock) across the
  N xdist workers inside each shard. Without --durations, falls back to
  equal weights (test count per scope). Each shard is written to
  {output-dir}/shard-{i}.txt.

  --workers controls the assumed number of xdist workers per shard (default 3).
  Set to 4 for tier1 (runs with -n 4), 3 for tier2 (runs with -n 3).

Usage:
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt
    python split-tests-by-tier.py --classification report.json --summary
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 17 --output-dir /tmp/tier2-shards/ --durations /tmp/test-durations.json --workers 3
    python split-tests-by-tier.py --classification report.json --tier tier1 \\
        --shards 5 --output-dir /tmp/tier1-shards/ --durations /tmp/test-durations.json --workers 4
"""

from __future__ import annotations

import argparse
import json
import statistics
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


def load_durations(path: str, granularity: str) -> dict[str, float]:
    """Load merged durations JSON and aggregate to the requested granularity.

    The durations file (from merge-test-durations.py) is keyed at
    file::class scope. We aggregate up to whatever granularity the caller
    needs: file → sum all classes in the file; class → keep as-is;
    test → not directly supported (class-level data is the finest available).
    """
    with open(path) as f:
        raw: dict[str, float] = json.load(f)

    aggregated: dict[str, float] = defaultdict(float)
    for raw_key, duration in raw.items():
        if granularity == "file":
            key = raw_key.split("::")[0]
        elif granularity == "class":
            parts = raw_key.split("::")
            key = "::".join(parts[:2]) if len(parts) >= 2 else raw_key
        else:
            key = raw_key
        aggregated[key] += duration

    return dict(aggregated)


def _count_tests_per_scope(
    classification: dict, scopes: set[str], granularity: str
) -> dict[str, int]:
    """Count the number of tests in each scope for fallback weight estimation."""
    counts: dict[str, int] = defaultdict(int)
    for test_id in classification.get("tests", {}):
        scope = _scope_key(test_id, granularity)
        if scope in scopes:
            counts[scope] += 1
    return counts


def worker_lpt_shard(
    scopes: set[str],
    n_shards: int,
    n_workers: int,
    durations: dict[str, float],
    default_duration: float,
) -> list[list[str]]:
    """Worker-simulated LPT: assign scopes to shards minimising max wallclock.

    Each shard has n_workers xdist workers running in parallel (--dist=loadfile
    dispatches whole files to workers). Shard wall-clock = max(worker loads).

    Standard (flat) LPT minimises sum(loads) per shard, which is the wrong
    objective — a shard with all its load on one worker runs no faster than a
    shard with N balanced workers even if their totals are equal.

    This variant tracks per-worker loads for each shard and picks the assignment
    that minimises the resulting max(worker wallclock) globally.

    Complexity: O(scopes × shards × workers) — trivial for our workload sizes.
    Falls back gracefully when durations are missing (uses default_duration).
    """
    sorted_scopes = sorted(
        scopes,
        key=lambda s: durations.get(s, default_duration),
        reverse=True,
    )

    # worker_loads[shard][worker] = cumulative seconds assigned so far
    worker_loads: list[list[float]] = [[0.0] * n_workers for _ in range(n_shards)]
    shards: list[list[str]] = [[] for _ in range(n_shards)]

    for scope in sorted_scopes:
        duration = durations.get(scope, default_duration)
        best_shard = 0
        best_wallclock = float("inf")

        for s in range(n_shards):
            # This scope would be dispatched to the lightest worker in shard s.
            lightest = min(range(n_workers), key=lambda w: worker_loads[s][w])
            # Predicted shard wallclock after adding this scope.
            new_wallclock = max(
                worker_loads[s][lightest] + duration if w == lightest else worker_loads[s][w]
                for w in range(n_workers)
            )
            if new_wallclock < best_wallclock:
                best_wallclock = new_wallclock
                best_shard = s

        lightest = min(range(n_workers), key=lambda w: worker_loads[best_shard][w])
        worker_loads[best_shard][lightest] += duration
        shards[best_shard].append(scope)

    # Log predicted balance stats to stderr for CI visibility.
    predicted = [max(loads) for loads in worker_loads]
    total = sum(sum(loads) for loads in worker_loads)
    coverage = sum(1 for s in scopes if s in durations)
    print(
        f"[lpt] {n_shards} shards × {n_workers} workers: "
        f"total={total:.0f}s, "
        f"max_wallclock={max(predicted):.0f}s, "
        f"min_wallclock={min(predicted):.0f}s, "
        f"spread={max(predicted) - min(predicted):.0f}s "
        f"({coverage}/{len(scopes)} scopes with duration data)",
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
    parser.add_argument("--shards", type=int, help="Split tier into N balanced shards")
    parser.add_argument(
        "--output-dir", help="Output directory for per-shard files (requires --shards)"
    )
    parser.add_argument(
        "--durations",
        help="Path to merged test durations JSON (from merge-test-durations.py). "
        "When provided, uses worker-simulated LPT with real timings. "
        "Without this flag, falls back to test-count weights.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=3,
        help="Number of xdist workers per shard (default: 3). "
        "Used for worker-simulated LPT. Set to 4 for tier1, 3 for tier2.",
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
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        if args.durations:
            durations = load_durations(args.durations, args.granularity)
            # Default duration for scopes not in the map: median of known values.
            default_dur = statistics.median(durations.values()) if durations else 1.0
            print(
                f"[lpt] Using duration data: {len(durations)} scopes known, "
                f"default={default_dur:.1f}s",
                file=sys.stderr,
            )
            shards = worker_lpt_shard(scopes, args.shards, args.workers, durations, default_dur)
        else:
            # No duration data — fall back to test-count weights.
            print("[lpt] No duration data provided, using test-count weights", file=sys.stderr)
            weights = _count_tests_per_scope(classification, scopes, args.granularity)
            # Reuse worker_lpt_shard with count weights converted to floats.
            count_durations = {s: float(w) for s, w in weights.items()}
            default_dur = statistics.median(count_durations.values()) if count_durations else 1.0
            shards = worker_lpt_shard(
                scopes, args.shards, args.workers, count_durations, default_dur
            )

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
