#!/usr/bin/env python3
"""Run one shard of a sharded pytest run, with the tests split by file.

Usage: python3 -b pytest-selected.py [pytest args...]

Without this, every shard imports every test file and the pytest plugin then
drops the tests that belong to other shards. Instead, each shard only imports
its own files. pytest args pass through unchanged.

- Selective runs (SELECTED_TESTS_FILE set): each shard gets whole selected
  files, balanced by the per-file test counts in `selected-tests.counts.json`.
  A file too big for one shard gets several shards, which split it by test.
- Full runs: each shard gets whole files and hash slices of the slowest files,
  balanced by the per-file durations in `backend-test-durations.json`. The plan
  depends only on the checkout (file tree and that file), so a commit always
  gets the same shards. Tests keep collection order within a shard. Without that
  file, every shard collects everything and keeps its hash share, as before.
"""

from __future__ import annotations

import json
import math
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pytest

DURATIONS_FILE = Path(__file__).parent / "backend-test-durations.json"
# Full runs split files slower than 1/PIECES_PER_SHARD of a shard by test.
# Files run in collection order, so a big file that starts late on an xdist
# worker holds up the whole shard; this bounds how big that can be.
PIECES_PER_SHARD = 48


@dataclass(frozen=True)
class Shard:
    files: list[str]
    # For the pytest plugin's per-test sharding, which splits a file that got
    # several shards.
    item_groups: int = 1
    item_group: int = 0
    # Full runs only: {path: (part, parts)} for files split across shards.
    parts: dict[str, tuple[int, int]] = field(default_factory=dict)


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


def plan_full_shards(weights: dict[str, float], total: int) -> list[Shard] | None:
    """Split every test file into `total` shards. Every shard must compute the same plan.

    Files slower than 1/PIECES_PER_SHARD of a shard are cut into equal parts of
    at most that size, each on a different shard. Parts and whole files go
    heaviest first onto the lightest shard, ties broken by path. Returns None if
    a shard would get no files.
    """
    target = sum(weights.values()) / total
    cap = target / PIECES_PER_SHARD
    pieces = []
    for path, weight in weights.items():
        parts = min(total, math.ceil(weight / cap)) if cap and weight > cap else 1
        pieces += [(weight / parts, path, part, parts) for part in range(parts)]

    loads = [0.0] * total
    shards: list[dict[str, tuple[int, int]]] = [{} for _ in range(total)]
    for weight, path, part, parts in sorted(pieces, key=lambda p: (-p[0], p[1], p[2])):
        i = min((i for i in range(total) if path not in shards[i]), key=lambda i: (loads[i], i))
        shards[i][path] = (part, parts)
        loads[i] += weight

    if not all(shards):
        return None
    return [
        Shard(sorted(files), parts={path: pp for path, pp in files.items() if pp[1] > 1})
        for files in shards
    ]


def list_test_files(args: list[str]) -> list[str]:
    """Every .py file pytest could collect from the paths in `args`, minus --ignore.

    Non-test files are harmless: pytest doesn't collect them either way. Missing
    one that pytest does collect would drop its tests, so this errs wide.
    """
    roots, ignored = [], set()
    it = iter(args)
    for arg in it:
        if arg == "--ignore":
            ignored.add(os.path.normpath(next(it, "")))
        elif arg.startswith("--ignore="):
            ignored.add(os.path.normpath(arg.split("=", 1)[1]))
        elif not arg.startswith("-") and os.path.exists(arg):
            roots.append(os.path.normpath(arg))

    files: set[str] = set()
    for root in roots:
        if os.path.isfile(root):
            files.add(root)
        for dirpath, dirnames, filenames in os.walk(root):
            if dirpath in ignored:
                dirnames[:] = []
                continue
            dirnames[:] = [d for d in dirnames if d != "__pycache__"]
            for name in filenames:
                path = os.path.join(dirpath, name)
                if name.endswith(".py") and name != "conftest.py" and path not in ignored:
                    files.add(path)
    return sorted(files)


def file_weights(files: list[str]) -> dict[str, float]:
    """Seconds per file from the last full run, estimated from test counts for new files."""
    durations = json.loads(DURATIONS_FILE.read_text())
    known: dict[str, float] = durations["files"]
    weights = {}
    for path in files:
        if path in known:
            weights[path] = known[path]
        elif os.path.basename(path).startswith("test_"):
            from count_test_items import count_tests_in_file

            weights[path] = count_tests_in_file(Path(path)) * durations["seconds_per_test"]
        else:
            weights[path] = 0.0
    return weights


def per_file_plan_applies(args: list[str], files: list[str]) -> bool:
    """Whether planning by file gives each shard the tests pytest would run.

    `-m`/`-k` filter after the plan, so most shards could end up with no
    selected tests (e.g. `-m snuba_ci` in Snuba's CI). The sentry plugin
    matches the planned paths relative to the rootdir, which
    pytest_shard_plugin checks is the working directory.
    """
    every_arg = [*args, *shlex.split(os.environ.get("PYTEST_ADDOPTS", ""))]
    if any(arg.startswith(("-m", "-k")) and not arg.startswith("--") for arg in every_arg):
        return False
    return not any(os.path.isabs(f) or f.startswith(os.pardir + os.sep) for f in files)


def start_assert_rewrite_prewarm(shard_file: Path) -> None:
    """Rewrite the shard's test files once in the background instead of in every
    xdist worker. See prewarm_assert_rewrite.py."""
    # Without xdist the one pytest process would just race it for the same work.
    if "-n" in shlex.split(os.environ.get("PYTEST_ADDOPTS", "")):
        subprocess.Popen(
            [sys.executable, str(Path(__file__).parent / "prewarm_assert_rewrite.py"), shard_file],
            stdin=subprocess.DEVNULL,
        )


def run_full_shard(args: list[str], total: int, group: int) -> int:
    files = list_test_files(args)
    if not per_file_plan_applies(args, files):
        # As before per-file sharding: every shard collects everything and the
        # sentry plugin keeps its hash share of the items.
        print(
            "pytest-selected: -m/-k or paths outside the working directory, so "
            "every shard collects everything and keeps its hash share",
            file=sys.stderr,
        )
        return int(pytest.main(args))
    plan = plan_full_shards(file_weights(files), total) if files else None
    if plan is None:
        return int(pytest.main(args))
    shard = plan[group]

    print(
        f"pytest-selected: shard {group + 1}/{total} runs {len(shard.files)} of "
        f"{len(files)} files, {len(shard.parts)} of them split",
        file=sys.stderr,
    )
    artifacts = Path(".artifacts")
    artifacts.mkdir(exist_ok=True)
    shard_file = artifacts / f"full-tests.shard-{group}.txt"
    shard_file.write_text("".join(f"{path}\n" for path in shard.files))
    parts_file = shard_file.with_suffix(".json")
    parts_file.write_text(json.dumps(shard.parts))
    # SELECTED_TESTS_FILE makes the sentry pytest plugin skip other shards'
    # files at collection; pytest_shard_plugin (loaded in xdist workers too)
    # keeps this shard's part of each split file.
    os.environ["SELECTED_TESTS_FILE"] = str(shard_file)
    os.environ["TOTAL_TEST_GROUPS"] = "1"
    os.environ["TEST_GROUP"] = "0"
    os.environ["PYTEST_SHARD_PARTS"] = str(parts_file)
    os.environ["PYTHONPATH"] = os.pathsep.join(
        filter(None, [str(Path(__file__).parent), os.environ.get("PYTHONPATH")])
    )
    os.environ["PYTEST_PLUGINS"] = ",".join(
        filter(None, [os.environ.get("PYTEST_PLUGINS"), "pytest_shard_plugin"])
    )
    start_assert_rewrite_prewarm(shard_file)
    return int(pytest.main(args))


def main(args: list[str]) -> int:
    selected_file = os.environ.get("SELECTED_TESTS_FILE")
    total = int(os.environ.get("TOTAL_TEST_GROUPS", 1))
    group = int(os.environ.get("TEST_GROUP", 0))
    if not selected_file and total > 1 and DURATIONS_FILE.is_file():
        return run_full_shard(args, total, group)
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

    start_assert_rewrite_prewarm(shard_file)
    exit_code = pytest.main(args)
    # Counts are estimates, so a shard can end up with no tests.
    if exit_code == pytest.ExitCode.NO_TESTS_COLLECTED:
        return 0
    return int(exit_code)


if __name__ == "__main__":
    # Match `python -m pytest`, which puts the working directory (not this
    # script's directory) first on sys.path.
    sys.path[0] = os.getcwd()
    sys.path.append(str(Path(__file__).parent))
    raise SystemExit(main(sys.argv[1:]))
