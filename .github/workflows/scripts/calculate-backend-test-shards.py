#!/usr/bin/env python3
import json
import math
import os
import re
import subprocess
import sys
import traceback

TESTS_PER_SHARD = 1200
MIN_SHARDS = 1
MAX_SHARDS = 22
DEFAULT_SHARDS = 22


def collect_test_count():
    try:
        result = subprocess.run(
            [
                "python",
                ".github/workflows/scripts/pytest-args-wrapper.py",
                "selected-tests-65f073a3736a99a06b1326150f10157962da994d",
                "--collect-only",
                "--quiet",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        # Parse output for "N tests collected"
        match = re.search(r"(\d+) tests? collected", result.stdout + result.stderr)
        if match:
            count = int(match.group(1))
            print(f"Collected {count} tests", file=sys.stderr)
            return count

        # If subprocess failed, dump full info
        if result.returncode != 0:
            print(f"Pytest collection failed (exit {result.returncode})", file=sys.stderr)
            print(
                f"Command: python .github/workflows/scripts/pytest-args-wrapper.py @selected-tests-65f073a3736a99a06b1326150f10157962da994d --collect-only --quiet",
                file=sys.stderr,
            )
            print("=== STDOUT ===", file=sys.stderr)
            print(result.stdout, file=sys.stderr)
            print("=== STDERR ===", file=sys.stderr)
            print(result.stderr, file=sys.stderr)
            return None

        print("No tests collected", file=sys.stderr)
        return 0

    except Exception as e:
        print(f"Error collecting tests: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(1)


def calculate_shards(test_count):
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


def main():
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
