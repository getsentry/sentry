#!/usr/bin/env python3
"""Run one shard of a selective pytest run, with the selection split by file.

Usage: python3 -b pytest-selected.py [pytest args...]

Without this, every shard imports every file in SELECTED_TESTS_FILE and the
pytest plugin then drops the tests that belong to other shards. Instead, each
shard gets its own whole files, balanced by the per-file test counts in
`selected-tests.counts.json`. A file too big for one shard gets several shards,
which split it by test. pytest args pass through unchanged.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import pytest


@dataclass(frozen=True)
class Shard:
    files: list[str]
    # For the pytest plugin's per-test sharding, which splits a file that got
    # several shards.
    item_groups: int = 1
    item_group: int = 0


def plan_shards(weights: dict[str, int], total: int) -> list[Shard]:
    """Split files into `total` shards. Every shard must compute the same plan.

    Files worth about 1.5 shards or more get dedicated shards. The rest share
    the remaining shards, heaviest first onto the lightest shard.
    """
    target = sum(weights.values()) / total
    groups = {path: max(1, round(w / target)) for path, w in weights.items()}

    # Adjust until every shared shard has at least one file to run.
    while True:
        split = {path: g for path, g in groups.items() if g > 1}
        shared_files = len(groups) - len(split)
        shared_shards = total - sum(split.values())
        if shared_files and shared_shards < 1:
            path = max(split, key=lambda p: (split[p], p))
            groups[path] -= 1
        elif shared_shards > shared_files:
            path = max(groups, key=lambda p: (weights[p] / groups[p], p))
            groups[path] += 1
        else:
            break

    bins: list[list[str]] = [[] for _ in range(shared_shards)]
    loads = [0] * shared_shards
    for path in sorted(groups.keys() - split.keys(), key=lambda p: (-weights[p], p)):
        i = loads.index(min(loads))
        bins[i].append(path)
        loads[i] += weights[path]

    shards = [Shard(sorted(files)) for files in bins]
    for path in sorted(split):
        shards += [Shard([path], split[path], i) for i in range(split[path])]
    return shards


def main(args: list[str]) -> int:
    selected_file = os.environ.get("SELECTED_TESTS_FILE")
    total = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
    group = int(os.environ.get("TEST_GROUP", 0))
    if not selected_file or not os.path.isfile(selected_file) or total <= 1:
        return int(pytest.main(args))
    with open(selected_file) as f:
        selected = [line.strip() for line in f if line.strip()]
    if not selected:
        return int(pytest.main(args))

    counts_file = Path(selected_file).with_suffix(".counts.json")
    counts = json.loads(counts_file.read_text()) if counts_file.is_file() else {}
    shard = plan_shards({path: max(counts.get(path, 1), 1) for path in selected}, total)[group]

    split = f", part {shard.item_group + 1}/{shard.item_groups}" if shard.item_groups > 1 else ""
    print(
        f"pytest-selected: shard {group + 1}/{total} runs {len(shard.files)} of "
        f"{len(selected)} selected files{split}",
        file=sys.stderr,
    )
    # Files go through SELECTED_TESTS_FILE rather than as pytest args: pytest
    # imports the conftests of explicit paths before the plugins configure
    # Django, which breaks conftests that import models.
    shard_file = Path(selected_file).with_suffix(f".shard-{group}.txt")
    shard_file.write_text("".join(f"{path}\n" for path in shard.files))
    os.environ["SELECTED_TESTS_FILE"] = str(shard_file)
    os.environ["TOTAL_TEST_GROUPS"] = str(shard.item_groups)
    os.environ["TEST_GROUP"] = str(shard.item_group)

    exit_code = pytest.main(args)
    # Counts are estimates, so a shard can end up with no tests.
    if exit_code == pytest.ExitCode.NO_TESTS_COLLECTED:
        return 0
    return int(exit_code)


if __name__ == "__main__":
    # Match `python -m pytest`, which puts the working directory (not this
    # script's directory) first on sys.path.
    sys.path[0] = os.getcwd()
    raise SystemExit(main(sys.argv[1:]))
