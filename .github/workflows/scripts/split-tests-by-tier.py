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
  balanced shards and each shard is written to {output-dir}/shard-{i}.txt.

  Sharding strategy:
    - With --durations-file: worker-simulated LPT (see below).
    - Without: hash-based round-robin (sha256 of scope name mod N).

  Worker-simulated LPT (--durations-file, --n-workers):
    Each shard runs --n-workers xdist workers in parallel with --dist=loadfile,
    so shard wall-clock = max(worker loads), not sum(worker loads). Flat LPT
    optimises the sum and produces terrible wall-clock balance (proven in
    experiment "LPT Second Run Analysis"). Worker-simulated LPT instead tracks
    per-worker loads within each candidate shard and picks the assignment that
    minimises the global max wall-clock.

    Algorithm:
      1. Sort scopes heaviest-first by duration.
      2. For each scope, for each candidate shard:
           - Find that shard's lightest worker.
           - Compute predicted_wallclock = max(worker loads after placing scope
             on the lightest worker).
      3. Assign to the shard with the lowest predicted_wallclock.

    Optional swap refinement (--swap-rounds N, default 50):
      After the initial greedy pass, iteratively try swapping scopes between
      the heaviest and lightest shards. Accept swaps that reduce the global
      max wall-clock. Converges quickly in practice.

  Fallback (no duration data / new scopes):
    Scopes not present in the durations file use the median of known durations
    (or 1.0 if none). This keeps unknown scopes from dominating assignment.

Usage:
    # Tier summary
    python split-tests-by-tier.py --classification report.json --summary

    # Single-tier output
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt

    # Worker-simulated LPT sharding for T2
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 17 --output-dir /tmp/tier2-shards/ \\
        --durations-file /tmp/test-durations.json --n-workers 3

    # Hash-based sharding (seed run, no duration data)
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 17 --output-dir /tmp/tier2-shards/
"""

from __future__ import annotations

import argparse
import hashlib
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


# ---------------------------------------------------------------------------
# Tier splitting
# ---------------------------------------------------------------------------


def _scope_key(test_id: str, granularity: str) -> str:
    if granularity == "file":
        return test_id.split("::")[0]
    elif granularity == "class":
        parts = test_id.split("::")
        # Module-level tests (file::test_fn) have no class component.
        # --dist=loadscope groups them by file, and merge-test-durations.py
        # stores them under the file key. Use file to match.
        if len(parts) >= 3:
            return "::".join(parts[:2])  # file::ClassName
        return parts[0]  # file (module-level)
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


# ---------------------------------------------------------------------------
# Sharding: hash-based fallback
# ---------------------------------------------------------------------------


def hash_shard(scopes: set[str], n_shards: int) -> list[list[str]]:
    """Deterministic hash-based sharding (sha256 of scope mod n_shards).

    Used when no duration data is available. Gives statistically even
    distribution for large scope counts without duration knowledge.
    """
    shards: list[list[str]] = [[] for _ in range(n_shards)]
    for scope in sorted(scopes):  # sorted for determinism
        idx = int(hashlib.sha256(scope.encode()).hexdigest(), 16) % n_shards
        shards[idx].append(scope)
    return shards


# ---------------------------------------------------------------------------
# Sharding: flat LPT (for --dist=load)
# ---------------------------------------------------------------------------


def flat_lpt_shard(
    scopes: set[str],
    n_shards: int,
    n_workers: int,
    durations: dict[str, float],
) -> list[list[str]]:
    """Flat LPT minimising max total duration per shard.

    Correct model for --dist=load, where xdist distributes individual tests
    round-robin across workers regardless of scope boundaries. Shard wallclock
    ≈ sum(scope_durations) / n_workers, so we just minimise the max sum.
    """
    known = [v for v in durations.values() if v > 0]
    fallback = statistics.median(known) if known else 1.0

    sorted_scopes = sorted(
        scopes,
        key=lambda s: durations.get(s, fallback),
        reverse=True,
    )

    shard_totals = [0.0] * n_shards
    shards: list[list[str]] = [[] for _ in range(n_shards)]

    for scope in sorted_scopes:
        dur = durations.get(scope, fallback)
        best = min(range(n_shards), key=lambda i: shard_totals[i])
        shard_totals[best] += dur
        shards[best].append(scope)

    max_total = max(shard_totals)
    min_total = min(shard_totals)
    total = sum(shard_totals)
    max_wc = max_total / n_workers
    min_wc = min_total / n_workers
    print(
        f"[flat-lpt] {n_shards} shards × {n_workers} workers: "
        f"total={total:.0f}s, max_wallclock={max_wc:.1f}s, "
        f"min_wallclock={min_wc:.1f}s, spread={max_wc - min_wc:.1f}s",
        file=sys.stderr,
    )

    return shards


# ---------------------------------------------------------------------------
# Sharding: worker-simulated LPT (for --dist=loadfile / --dist=loadscope)
# ---------------------------------------------------------------------------


def _simulate_wallclock(files: list[str], n_workers: int, durations: dict[str, float]) -> float:
    """Simulate --dist=loadfile LPT dispatch: return max(worker loads).

    Sorts files heaviest-first (matching xdist's internal dispatch order) and
    greedily assigns each to the lightest worker.
    """
    worker_times = [0.0] * n_workers
    for f in sorted(files, key=lambda s: durations.get(s, 0.0), reverse=True):
        lightest = min(range(n_workers), key=lambda w: worker_times[w])
        worker_times[lightest] += durations.get(f, 0.0)
    return max(worker_times) if worker_times else 0.0


def worker_simulated_lpt_shard(
    scopes: set[str],
    n_shards: int,
    n_workers: int,
    durations: dict[str, float],
) -> list[list[str]]:
    """Greedy LPT minimising shard wall-clock time (max worker load).

    Unlike flat LPT (which minimises sum per shard), this tracks per-worker
    loads within each candidate shard and assigns each scope to the shard
    where placing it — on that shard's lightest worker — yields the lowest
    global max wall-clock.
    """
    # Fallback weight for scopes without duration data: median known duration.
    known = [v for v in durations.values() if v > 0]
    fallback = statistics.median(known) if known else 1.0

    sorted_scopes = sorted(
        scopes,
        key=lambda s: durations.get(s, fallback),
        reverse=True,
    )

    # worker_loads[shard_idx][worker_idx] = cumulative seconds assigned
    worker_loads: list[list[float]] = [[0.0] * n_workers for _ in range(n_shards)]
    shards: list[list[str]] = [[] for _ in range(n_shards)]

    for scope in sorted_scopes:
        dur = durations.get(scope, fallback)

        best_shard = 0
        best_wallclock = float("inf")

        for shard_idx in range(n_shards):
            workers = worker_loads[shard_idx]
            # This scope goes to the lightest worker in this candidate shard.
            min_w = min(range(n_workers), key=lambda w: workers[w])
            predicted = max(
                workers[w] + (dur if w == min_w else 0) for w in range(n_workers)
            )
            if predicted < best_wallclock:
                best_wallclock = predicted
                best_shard = shard_idx

        min_w = min(range(n_workers), key=lambda w: worker_loads[best_shard][w])
        worker_loads[best_shard][min_w] += dur
        shards[best_shard].append(scope)

    # Log balance stats.
    wallclocks = [_simulate_wallclock(s, n_workers, durations) for s in shards]
    max_wc = max(wallclocks)
    min_wc = min(wallclocks)
    total = sum(durations.get(s, fallback) for shard in shards for s in shard)
    print(
        f"[lpt] {n_shards} shards × {n_workers} workers: "
        f"total={total:.0f}s, max_wallclock={max_wc:.1f}s, "
        f"min_wallclock={min_wc:.1f}s, spread={max_wc - min_wc:.1f}s",
        file=sys.stderr,
    )

    return shards


def swap_refine(
    shards: list[list[str]],
    n_workers: int,
    durations: dict[str, float],
    max_rounds: int = 50,
) -> list[list[str]]:
    """Swap-based refinement between the heaviest and lightest shards.

    After the initial greedy LPT pass, iteratively swap scopes between the
    heaviest and lightest shards if the swap reduces the global max wall-clock.
    Only pairs the two extreme shards each round — O(files_per_shard²) per
    round instead of O(all_pairs²), which keeps this tractable.
    """
    known = [v for v in durations.values() if v > 0]
    fallback = statistics.median(known) if known else 1.0

    def dur(scope: str) -> float:
        return durations.get(scope, fallback)

    wallclocks = [_simulate_wallclock(s, n_workers, durations) for s in shards]

    for round_num in range(max_rounds):
        heavy_idx = max(range(len(shards)), key=lambda i: wallclocks[i])
        light_idx = min(range(len(shards)), key=lambda i: wallclocks[i])

        if heavy_idx == light_idx:
            break

        global_max = wallclocks[heavy_idx]

        # Max wallclock of shards we're not touching — a lower bound on
        # the new global max regardless of the swap outcome.
        rest_max = (
            max(wc for i, wc in enumerate(wallclocks) if i not in (heavy_idx, light_idx))
            if len(shards) > 2
            else 0.0
        )

        improved = False

        # Try heaviest scopes from the heavy shard first; lightest from light.
        heavy_sorted = sorted(shards[heavy_idx], key=dur, reverse=True)
        light_sorted = sorted(shards[light_idx], key=dur)

        for fa in heavy_sorted:
            heavy_without_fa = [f for f in shards[heavy_idx] if f != fa]

            # Early skip: if the heavy shard without fa is still >= global_max,
            # no swap of fa can reduce the heavy shard below global_max.
            if _simulate_wallclock(heavy_without_fa, n_workers, durations) >= global_max:
                continue

            for fb in light_sorted:
                heavy_new = heavy_without_fa + [fb]
                new_heavy_wc = _simulate_wallclock(heavy_new, n_workers, durations)

                if new_heavy_wc >= global_max:
                    continue

                light_new = [f for f in shards[light_idx] if f != fb] + [fa]
                new_light_wc = _simulate_wallclock(light_new, n_workers, durations)
                new_max = max(new_heavy_wc, new_light_wc, rest_max)

                if new_max < global_max:
                    shards[heavy_idx] = heavy_new
                    shards[light_idx] = light_new
                    wallclocks[heavy_idx] = new_heavy_wc
                    wallclocks[light_idx] = new_light_wc
                    improved = True
                    break

            if improved:
                break

        if not improved:
            print(
                f"[swap] Converged after {round_num + 1} round(s), "
                f"spread={global_max - wallclocks[light_idx]:.1f}s",
                file=sys.stderr,
            )
            break

    wallclocks = [_simulate_wallclock(s, n_workers, durations) for s in shards]
    max_wc = max(wallclocks)
    min_wc = min(wallclocks)
    print(
        f"[swap] Final: max_wallclock={max_wc:.1f}s, "
        f"min_wallclock={min_wc:.1f}s, spread={max_wc - min_wc:.1f}s",
        file=sys.stderr,
    )

    return shards


# ---------------------------------------------------------------------------
# Summary helpers
# ---------------------------------------------------------------------------


def _count_tests_per_scope(
    classification: dict, scopes: set[str], granularity: str
) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for test_id in classification.get("tests", {}):
        scope = _scope_key(test_id, granularity)
        if scope in scopes:
            counts[scope] += 1
    return counts


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Split tests into tiers")
    parser.add_argument("--classification", required=True)
    parser.add_argument("--tier", choices=["tier1", "tier2"])
    parser.add_argument("--output", help="Output file (default: stdout)")
    parser.add_argument("--granularity", choices=["file", "class", "test"], default="file")
    parser.add_argument("--summary", action="store_true")

    # Sharding
    parser.add_argument("--shards", type=int, help="Split tier into N shards")
    parser.add_argument(
        "--output-dir", help="Output directory for per-shard files (requires --shards)"
    )

    # Worker-simulated LPT options
    parser.add_argument(
        "--durations-file",
        help="JSON file mapping scope → duration in seconds (from merge-test-durations.py). "
        "Enables worker-simulated LPT. Without this, falls back to hash-based sharding.",
    )
    parser.add_argument(
        "--n-workers",
        type=int,
        default=3,
        help="Number of xdist workers per shard (default: 3)",
    )
    parser.add_argument(
        "--swap-rounds",
        type=int,
        default=50,
        help="Max swap-refinement rounds after initial LPT (default: 50, 0 to disable)",
    )
    parser.add_argument(
        "--flat-lpt",
        action="store_true",
        help="Use flat LPT (minimise max sum per shard) instead of worker-simulated LPT. "
        "Correct for --dist=load where xdist distributes individual tests across workers.",
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

        if args.durations_file:
            # LPT sharding using real per-scope durations.
            with open(args.durations_file) as f:
                durations: dict[str, float] = json.load(f)

            coverage = sum(1 for s in scopes if s in durations)
            print(
                f"[lpt] Duration coverage: {coverage}/{len(scopes)} scopes "
                f"({coverage / len(scopes) * 100:.1f}%)",
                file=sys.stderr,
            )

            if args.flat_lpt:
                # Flat LPT: correct for --dist=load (xdist distributes
                # individual tests, so shard wallclock ≈ sum / n_workers).
                shards = flat_lpt_shard(scopes, args.shards, args.n_workers, durations)
            else:
                # Worker-simulated LPT: correct for --dist=loadfile or
                # --dist=loadscope (entire scope goes to one worker).
                shards = worker_simulated_lpt_shard(scopes, args.shards, args.n_workers, durations)

            if args.swap_rounds > 0:
                shards = swap_refine(shards, args.n_workers, durations, args.swap_rounds)
        else:
            # No duration data: hash-based sharding (stable, good fallback).
            print(
                "[lpt] No --durations-file provided; using hash-based sharding (seed run).",
                file=sys.stderr,
            )
            shards = hash_shard(scopes, args.shards)

            test_counts = _count_tests_per_scope(classification, scopes, args.granularity)
            shard_counts = [sum(test_counts.get(s, 1) for s in shard) for shard in shards]
            print(
                f"[hash] {args.shards} shards: max={max(shard_counts)} tests, "
                f"min={min(shard_counts)} tests, spread={max(shard_counts) - min(shard_counts)}",
                file=sys.stderr,
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
