#!/usr/bin/env python3
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

# Allow override via environment variable
TESTS_PER_SHARD = int(os.environ.get("TESTS_PER_SHARD", 1200))
MIN_SHARDS = 1
MAX_SHARDS = 22
DEFAULT_SHARDS = 22


def collect_test_count() -> int | None:
    """Collect the number of tests to run, either from selected files or full suite."""
    selected_tests_file = os.environ.get("SELECTED_TESTS_FILE")

    if selected_tests_file:
        path = Path(selected_tests_file)
        if not path.exists():
            print(f"Selected tests file not found: {selected_tests_file}", file=sys.stderr)
            return None

        with path.open() as f:
            selected_files = [line.strip() for line in f if line.strip()]

        if not selected_files:
            print("No selected test files, running 0 tests", file=sys.stderr)
            return 0

        print(f"Counting tests in {len(selected_files)} selected files", file=sys.stderr)

    pytest_args = [
        "pytest",
        # Always pass tests/ directory to ensure proper conftest loading order.
        # SELECTED_TESTS_FILE env var triggers filtering in pytest_collection_modifyitems.
        "tests",
        "--collect-only",
        "--quiet",
        "--ignore=tests/acceptance",
        "--ignore=tests/apidocs",
        "--ignore=tests/js",
        "--ignore=tests/tools",
    ]

    # Pass TEST_TIER to pytest subprocess if set
    env = os.environ.copy()
    test_tier = os.environ.get("TEST_TIER")
    if test_tier:
        print(f"Filtering tests for tier: {test_tier}", file=sys.stderr)
        env["TEST_TIER"] = test_tier

    try:
        result = subprocess.run(
            pytest_args,
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )

        # Parse output for test count
        # Format without deselection: "27000 tests collected in 18.53s"
        # Format with deselection: "29/31510 tests collected (31481 deselected) in 18.13s"
        output = result.stdout + result.stderr

        # Try format with deselection first (selected/total)
        match = re.search(r"(\d+)/\d+ tests? collected", output)
        if match:
            count = int(match.group(1))
            print(f"Collected {count} tests", file=sys.stderr)
            return count

        # Fall back to format without deselection
        match = re.search(r"(\d+) tests? collected", output)
        if match:
            count = int(match.group(1))
            print(f"Collected {count} tests", file=sys.stderr)
            return count

        if result.returncode != 0:
            print(
                f"Pytest collection failed (exit {result.returncode})",
                file=sys.stderr,
            )
            print(result.stderr, file=sys.stderr)
            return None

        print("No tests collected", file=sys.stderr)
        return 0
    except Exception as e:
        print(f"Error collecting tests: {e}", file=sys.stderr)
        return None


def calculate_shards(test_count: int | None) -> int:
    if test_count is None:
        print(f"Using default shard count: {DEFAULT_SHARDS}", file=sys.stderr)
        return DEFAULT_SHARDS

    if test_count == 0:
        print(f"No tests to run, using minimum: {MIN_SHARDS}", file=sys.stderr)
        return MIN_SHARDS

    calculated = math.ceil(test_count / TESTS_PER_SHARD)
    bounded = max(MIN_SHARDS, min(calculated, MAX_SHARDS))

    if bounded != calculated:
        print(
            f"Calculated {calculated} shards, bounded to {bounded}",
            file=sys.stderr,
        )
    else:
        print(
            f"Calculated {bounded} shards ({test_count} tests ÷ {TESTS_PER_SHARD})",
            file=sys.stderr,
        )

    return bounded


def main() -> int:
    test_count = collect_test_count()
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
