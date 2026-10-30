#!/usr/bin/env python3
"""Calculate the number of backend test shards needed for CI.

Selected runs size shards by the per-file durations in
`backend-test-durations.json`, or by the test item estimate supplied by the
selection job when the selected files aren't available. Standalone runs can
count test files using static analysis without importing modules or
bootstrapping Django.
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

from count_test_items import count_tests_in_file, estimate_file_seconds

DURATIONS_FILE = Path(__file__).parent / "backend-test-durations.json"
# Selective runs aim for a slowest shard job of about 3 minutes on the PR
# runners (ubuntu-26.04-arm, XDIST_WORKERS=4 in backend.yml). Setup, pytest
# startup and collection take about 2.5 of those minutes, which leaves each
# xdist worker about this many seconds of tests, as timed in the durations
# file (Arm runs them about 25% faster than that).
WORKER_SECONDS_PER_SHARD = 40
XDIST_WORKERS = 4
TESTS_PER_SHARD = 300
MIN_SHARDS = 1
MAX_SHARDS = 30
DEFAULT_SHARDS = MAX_SHARDS

IGNORED_DIRS = frozenset(("tests/acceptance/", "tests/apidocs/", "tests/js/", "tests/tools/"))


def collect_test_count() -> int | None:
    """Use a supplied item count, or estimate items from local test files."""
    selected_item_count = os.environ.get("SELECTED_TEST_ITEM_COUNT")
    if selected_item_count is not None:
        try:
            test_count = int(selected_item_count)
        except ValueError:
            print(f"Invalid selected test item count: {selected_item_count!r}", file=sys.stderr)
            return None
        if test_count < 0:
            print(f"Selected test item count must be nonnegative: {test_count}", file=sys.stderr)
            return None
        return test_count

    selected_tests_file = os.environ.get("SELECTED_TESTS_FILE")

    if selected_tests_file:
        path = Path(selected_tests_file)
        if not path.exists():
            print(
                f"Selected tests file not found: {selected_tests_file}",
                file=sys.stderr,
            )
            return None

        test_files = [Path(line.strip()) for line in path.read_text().splitlines() if line.strip()]

        if not test_files:
            print("No selected test files, running 0 tests", file=sys.stderr)
            return 0

        print(f"Counting tests in {len(test_files)} selected files", file=sys.stderr)
    else:
        tests_dir = Path("tests")
        if not tests_dir.is_dir():
            print("tests/ directory not found", file=sys.stderr)
            return None

        test_files = sorted(
            p
            for p in tests_dir.rglob("test_*.py")
            if not any(str(p).startswith(d) for d in IGNORED_DIRS)
        )
        print(f"Found {len(test_files)} test files", file=sys.stderr)

    total = sum(count_tests_in_file(f) for f in test_files)
    print(f"Counted {total} tests via AST analysis", file=sys.stderr)
    return total


def selected_test_seconds() -> list[float] | None:
    """Estimated seconds for each selected test file, or None without the inputs."""
    selected_tests_file = os.environ.get("SELECTED_TESTS_FILE")
    if not selected_tests_file or not DURATIONS_FILE.is_file():
        return None
    path = Path(selected_tests_file)
    if not path.is_file():
        return None
    files = [line.strip() for line in path.read_text().splitlines() if line.strip()]
    return list(estimate_file_seconds(files, DURATIONS_FILE).values())


def calculate_shards_by_duration(seconds: list[float]) -> int:
    """Enough shards that no xdist worker gets more than WORKER_SECONDS_PER_SHARD.

    pytest-selected.py splits a slow file across shards, but runs each piece
    on one worker, so the slowest file needs enough shards on its own.
    """
    if not seconds:
        print("No tests to run, skipping (0 shards)", file=sys.stderr)
        return 0
    total = sum(seconds)
    needed = max(
        math.ceil(total / (XDIST_WORKERS * WORKER_SECONDS_PER_SHARD)),
        math.ceil(max(seconds) / WORKER_SECONDS_PER_SHARD),
    )
    bounded = max(MIN_SHARDS, min(needed, MAX_SHARDS))
    print(
        f"Calculated {bounded} shards ({total:.0f}s of tests, slowest file "
        f"{max(seconds):.0f}s, {WORKER_SECONDS_PER_SHARD}s per worker)",
        file=sys.stderr,
    )
    return bounded


def calculate_shards(test_count: int | None) -> int:
    if test_count is None:
        print(f"Using default shard count: {DEFAULT_SHARDS}", file=sys.stderr)
        return DEFAULT_SHARDS

    if test_count == 0:
        print("No tests to run, skipping (0 shards)", file=sys.stderr)
        return 0

    if test_count > MAX_SHARDS * TESTS_PER_SHARD:
        print(
            f"Test count {test_count} exceeds {MAX_SHARDS * TESTS_PER_SHARD}, using max shards: {MAX_SHARDS}",
            file=sys.stderr,
        )
        return MAX_SHARDS

    calculated = math.ceil(test_count / TESTS_PER_SHARD)
    bounded = max(MIN_SHARDS, min(calculated, MAX_SHARDS))

    print(
        f"Calculated {bounded} shards ({test_count} tests ÷ {TESTS_PER_SHARD})",
        file=sys.stderr,
    )

    return bounded


def main() -> int:
    seconds = selected_test_seconds()
    if seconds is not None:
        shard_count = calculate_shards_by_duration(seconds)
    else:
        test_count = collect_test_count()
        if test_count is None and "SELECTED_TEST_ITEM_COUNT" in os.environ:
            return 1
        shard_count = calculate_shards(test_count)
    shard_indices = json.dumps(list(range(shard_count)))

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write("\n")
            f.write(f"shard-count={shard_count}\n")
            f.write(f"shard-indices={shard_indices}\n")

    print(f"shard-count={shard_count}")
    print(f"shard-indices={shard_indices}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
