#!/usr/bin/env python3
"""Service-colored full backend runs: which shards start Snuba, and which tests need it.

Full runs put the test files that use Snuba, ClickHouse, Kafka or Symbolicator
on the first BACKEND_SNUBA_SHARDS shards (devservices mode `backend-ci`) and
every other file on "lite" shards (`backend-ci-lite`: no Snuba, ClickHouse,
Kafka or Symbolicator, and no per-worker Snuba bootstrap). pytest-selected.py
plans the split from `backend-test-services.json`; pytest_service_guard.py
records service use on Snuba shards and fails any test that tries one on a lite
shard. Selective PR runs keep every service.

    pick-shard    Write this matrix shard's devservices mode and guard mode to
                  $GITHUB_ENV (backend.yml).
    inventory     Every shard's `backend-service-usage-*` artifacts ->
                  backend-test-services.json. Refresh it from a green full run:

        gh run download RUN_ID --repo getsentry/sentry \\
            --pattern 'backend-service-usage-*' --dir /tmp/usage
        python3 .github/workflows/scripts/backend-test-services.py inventory \\
            .github/workflows/scripts/backend-test-services.json /tmp/usage/*/*.json

                  Files used services if any shard saw them do so. Files that no
                  shard ran (new, renamed, or from a failed shard) drop out and
                  go to Snuba shards until the next refresh.
    suggest       Predicted per-shard test-seconds for each BACKEND_SNUBA_SHARDS.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from pathlib import Path


def pick_shard(env: dict[str, str]) -> dict[str, str]:
    selective = env["SELECTIVE"] == "true"
    snuba_shards = int(env["BACKEND_SNUBA_SHARDS"])
    instance = int(env["MATRIX_INSTANCE"])
    if selective:
        color, guard = "", ""
    elif snuba_shards == 0:
        # Not colored yet, but measure, to build backend-test-services.json.
        color, guard = "", "record"
    elif instance < snuba_shards:
        color, guard = "snuba", "record"
    else:
        color, guard = "lite", "enforce"
    return {
        "BACKEND_TEST_SERVICE_COLOR": color,
        "BACKEND_TEST_SERVICE_GUARD": guard,
        "BACKEND_DEVSERVICES_MODE": "backend-ci-lite" if color == "lite" else "backend-ci",
        "XDIST_PER_WORKER_SNUBA": "" if color == "lite" else "1",
    }


def inventory(usages: list[dict[str, object]]) -> dict[str, object]:
    files: dict[str, set[str]] = {}
    for usage in usages:
        for path, services in usage["files"].items():  # type: ignore[attr-defined]
            files.setdefault(path, set()).update(services)
    return {"files": {path: sorted(files[path]) for path in sorted(files)}}


def suggest(total: int) -> None:
    sys.path.insert(0, str(Path(__file__).parent))
    planner = importlib.import_module("pytest-selected")
    files = planner.list_test_files(
        ["tests", *(f"--ignore=tests/{d}" for d in ("acceptance", "apidocs", "js", "tools"))]
    )
    services = json.loads(planner.SERVICES_FILE.read_text())["files"]
    snuba_files = {path for path in files if planner.needs_snuba(path, services)}
    weights = planner.file_weights(files)
    snuba = sum(weights[path] for path in snuba_files)
    print(f"{len(snuba_files)}/{len(files)} files, {snuba:.0f}/{sum(weights.values()):.0f}s")
    print("snuba_shards  max_snuba_shard_s  max_lite_shard_s")
    for k in range(1, total):
        try:
            plan = planner.plan_colored_shards(weights, total, k, snuba_files)
        except ValueError:
            continue
        loads = [
            sum(weights[path] / shard.parts.get(path, (0, 1))[1] for path in shard.files)
            for shard in plan
        ]
        print(f"{k:12}  {max(loads[:k]):17.0f}  {max(loads[k:]):16.0f}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("pick-shard", help="this shard's services -> $GITHUB_ENV")
    p = sub.add_parser("inventory", help="service-usage artifacts -> the checked-in file")
    p.add_argument("output", type=Path)
    p.add_argument("inputs", type=Path, nargs="+")
    p = sub.add_parser("suggest", help="predicted shard loads per BACKEND_SNUBA_SHARDS")
    p.add_argument("--total", type=int, default=30)
    args = parser.parse_args()

    if args.command == "pick-shard":
        picked = pick_shard(dict(os.environ))
        with open(os.environ["GITHUB_ENV"], "a") as f:
            f.writelines(f"{key}={value}\n" for key, value in picked.items())
        print(picked)
    elif args.command == "inventory":
        result = inventory([json.loads(path.read_text()) for path in args.inputs])
        args.output.write_text(json.dumps(result, indent=2) + "\n")
    else:
        suggest(args.total)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
