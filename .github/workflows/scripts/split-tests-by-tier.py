#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

TIER2_SERVICES = {"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}


def split(classification: dict) -> dict[str, set[str]]:
    file_services: dict[str, set[str]] = defaultdict(set)
    for test_id, services in classification.get("tests", {}).items():
        file_services[test_id.split("::")[0]].update(services)

    tier1: set[str] = set()
    tier2: set[str] = set()
    for path, services in file_services.items():
        (tier2 if services & TIER2_SERVICES else tier1).add(path)

    return {"tier1": tier1, "tier2": tier2}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classification", required=True)
    parser.add_argument("--tier", choices=["tier1", "tier2"], required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.classification) as f:
        classification = json.load(f)

    if not classification.get("tests"):
        print("Error: classification JSON has no tests", file=sys.stderr)
        return 1

    tiers = split(classification)
    if not tiers["tier1"] and not tiers["tier2"]:
        print("Error: classification produced 0 files in both tiers", file=sys.stderr)
        return 1

    if not tiers["tier1"] or not tiers["tier2"]:
        print(
            f"Warning: tier1={len(tiers['tier1'])} tier2={len(tiers['tier2'])} — one tier is empty",
            file=sys.stderr,
        )

    scopes = sorted(tiers[args.tier])
    Path(args.output).write_text("\n".join(scopes) + "\n")
    print(
        f"tier1={len(tiers['tier1'])} tier2={len(tiers['tier2'])} -> wrote {len(scopes)} to {args.output}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
