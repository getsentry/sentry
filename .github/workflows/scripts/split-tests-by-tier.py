#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

TIER2_SERVICES = {"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}


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
        (tier2 if services & TIER2_SERVICES else tier1).add(scope)

    return {"tier1": tier1, "tier2": tier2}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classification", required=True)
    parser.add_argument("--tier", choices=["tier1", "tier2"], required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--granularity", choices=["file", "class"], default="file")
    args = parser.parse_args()

    with open(args.classification) as f:
        classification = json.load(f)

    tests = classification.get("tests", {})
    if not tests:
        print("Error: classification JSON has no 'tests' key or is empty", file=sys.stderr)
        return 1

    tiers = split(classification, granularity=args.granularity)
    if not tiers["tier1"] and not tiers["tier2"]:
        print("Error: classification produced 0 scopes in both tiers", file=sys.stderr)
        return 1

    if not tiers["tier1"] or not tiers["tier2"]:
        print(
            f"Warning: tier1={len(tiers['tier1'])} tier2={len(tiers['tier2'])} — one tier is empty",
            file=sys.stderr,
        )

    scopes = sorted(tiers[args.tier])
    Path(args.output).write_text("\n".join(scopes) + "\n")
    print(f"tier1={len(tiers['tier1'])} tier2={len(tiers['tier2'])} → wrote {len(scopes)} to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
