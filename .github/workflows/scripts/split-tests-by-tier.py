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
    - With --durations-file: dispatch-aware LPT (see below).
    - Without: hash-based round-robin (sha256 of scope name mod N).

  Dispatch-aware LPT (--durations-file, --n-workers, --dist-mode):
    The sharding model must match the xdist dispatch mode:

    --dist-mode loadfile (default, used by T1):
      Scopes are atomic: an entire file/class lands on one xdist worker.
      Shard wall-clock = max(worker loads). We simulate per-worker loads
      and pick the assignment minimising the global max wall-clock.

    --dist-mode load (used by T2):
      Tests dispatch individually across workers. A scope's tests scatter
      evenly across N workers, so its contribution to wall-clock ≈ dur/N.
      Shard wall-clock ≈ total_duration / n_workers. This reduces to flat
      LPT: minimise max(sum(shard_durations)).

  Fallback (no duration data / new scopes):
    Scopes not present in the durations file use the median of known durations
    (or 1.0 if none). This keeps unknown scopes from dominating assignment.

Usage:
    # Tier summary
    python split-tests-by-tier.py --classification report.json --summary

    # Single-tier output
    python split-tests-by-tier.py --classification report.json --tier tier1 --output tier1.txt

    # T1: worker-simulated LPT (--dist=loadfile)
    python split-tests-by-tier.py --classification report.json --tier tier1 \\
        --shards 6 --output-dir /tmp/tier1-shards/ \\
        --durations-file durations.json --n-workers 4 --dist-mode loadfile

    # T2: flat LPT (--dist=load)
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 16 --output-dir /tmp/tier2-shards/ \\
        --durations-file durations.json --n-workers 3 --dist-mode load

    # Hash-based sharding (seed run, no duration data)
    python split-tests-by-tier.py --classification report.json --tier tier2 \\
        --shards 16 --output-dir /tmp/tier2-shards/
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
        # merge-test-durations.py stores them under the file key. Use file to match.
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
# Sharding: dispatch-aware LPT
# ---------------------------------------------------------------------------


def _get_fallback(durations: dict[str, float]) -> float:
    known = [v for v in durations.values() if v > 0]
    return statistics.median(known) if known else 1.0


def flat_lpt_shard(
    scopes: set[str],
    n_shards: int,
    n_workers: int,
    durations: dict[str, float],
) -> list[list[str]]:
    """Flat LPT for --dist=load with heavy-scope penalty.

    Under --dist=load, xdist dispatches individual tests to workers, so a
    shard's wall-clock ≈ total_duration / n_workers when tests are uniformly
    sized. However, heavy scopes contain slow individual tests that block
    workers, achieving ~2x parallelism instead of 3x. Pure flat LPT packs
    heavy scopes together (equal total_dur) but the resulting shard runs
    slower due to worse intra-shard parallelism.

    Fix: use d^1.3 as the LPT weight instead of d. This penalizes heavy
    scopes super-linearly, causing the greedy algorithm to spread them
    across more shards instead of concentrating them.
    """
    fallback = _get_fallback(durations)
    exponent = 1.3

    def weight(scope: str) -> float:
        return durations.get(scope, fallback) ** exponent

    sorted_scopes = sorted(scopes, key=weight, reverse=True)

    shard_loads = [0.0] * n_shards
    shards: list[list[str]] = [[] for _ in range(n_shards)]

    for scope in sorted_scopes:
        w = weight(scope)
        min_idx = min(range(n_shards), key=lambda i: shard_loads[i])
        shards[min_idx].append(scope)
        shard_loads[min_idx] += w

    # Log using raw durations for interpretability.
    raw_loads = [sum(durations.get(s, fallback) for s in shard) for shard in shards]
    max_raw = max(raw_loads)
    min_raw = min(raw_loads)
    total = sum(raw_loads)
    scope_counts = [len(s) for s in shards]
    print(
        f"[lpt-flat] {n_shards} shards × {n_workers} workers (--dist=load, d^{exponent}): "
        f"total={total:.0f}s, "
        f"predicted max_wallclock={max_raw / n_workers:.1f}s, "
        f"predicted min_wallclock={min_raw / n_workers:.1f}s, "
        f"scopes/shard: {min(scope_counts)}-{max(scope_counts)}",
        file=sys.stderr,
    )

    return shards


def worker_simulated_lpt_shard(
    scopes: set[str],
    n_shards: int,
    n_workers: int,
    durations: dict[str, float],
) -> list[list[str]]:
    """Worker-simulated LPT for --dist=loadfile: minimise max(max_worker_load).

    Under --dist=loadfile, scopes are atomic units assigned to one worker.
    Shard wall-clock = max(worker loads). We track per-worker loads within
    each candidate shard and pick the assignment that minimises the global
    max wall-clock.
    """
    fallback = _get_fallback(durations)

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
    wallclocks = [max(wl) for wl in worker_loads]
    max_wc = max(wallclocks)
    min_wc = min(wallclocks)
    total = sum(durations.get(s, fallback) for shard in shards for s in shard)
    print(
        f"[lpt-sim] {n_shards} shards × {n_workers} workers (--dist=loadfile): "
        f"total={total:.0f}s, max_wallclock={max_wc:.1f}s, "
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

    # LPT options
    parser.add_argument(
        "--durations-file",
        help="JSON file mapping scope → duration in seconds. "
        "Enables LPT sharding. Without this, falls back to hash-based sharding.",
    )
    parser.add_argument(
        "--n-workers",
        type=int,
        default=3,
        help="Number of xdist workers per shard (default: 3)",
    )
    parser.add_argument(
        "--dist-mode",
        choices=["loadfile", "load"],
        default="loadfile",
        help="xdist dispatch mode. 'loadfile' uses worker-simulated LPT "
        "(scopes are atomic per worker). 'load' uses flat LPT "
        "(tests scatter across workers). Default: loadfile.",
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
            with open(args.durations_file) as f:
                durations: dict[str, float] = json.load(f)

            coverage = sum(1 for s in scopes if s in durations)
            print(
                f"[lpt] Duration coverage: {coverage}/{len(scopes)} scopes "
                f"({coverage / len(scopes) * 100:.1f}%)",
                file=sys.stderr,
            )

            if args.dist_mode == "load":
                shards = flat_lpt_shard(scopes, args.shards, args.n_workers, durations)
            else:
                shards = worker_simulated_lpt_shard(
                    scopes, args.shards, args.n_workers, durations
                )
        else:
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
