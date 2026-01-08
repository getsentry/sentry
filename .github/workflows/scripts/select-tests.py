#!/usr/bin/env python3
import json
import math
import os
import sqlite3
import subprocess
import sys

TESTS_PER_SHARD = 1200
MIN_SHARDS = 1
MAX_SHARDS = 22
DEFAULT_SHARDS = 22

PYTEST_IGNORED_FILES = [
    # the pytest code itself is not part of the test suite but will be referenced by most tests
    "sentry/testutils/pytest/sentry.py",
]


def executed_lines(bitblob: bytes) -> set[int]:
    """
    Returns a set of executed line numbers for a coverage bitblob.
    Line numbers are 1-based.
    """
    lines = set()
    for byte_index, byte in enumerate(bitblob):
        for bit_index in range(8):
            if byte & (1 << bit_index):
                lines.add(byte_index * 8 + bit_index)
    return lines


def select_tests(coverage_db_path: str, changed_files: list[str]):
    test_nodeids = set()

    with sqlite3.connect(coverage_db_path) as conn:
        cursor = conn.cursor()

        for file_path in changed_files:
            if any(file_path.endswith(ignored_file) for ignored_file in PYTEST_IGNORED_FILES):
                continue

            cleaned_file_path = file_path
            if cleaned_file_path.startswith("/src"):
                cleaned_file_path = cleaned_file_path[len("/src") :]

            # TODO: change to IN query; much faster
            cursor.execute(
                """
                SELECT c.context, lb.numbits
                FROM line_bits lb
                JOIN file f    ON lb.file_id = f.id
                JOIN context c ON lb.context_id = c.id
                WHERE f.path LIKE '%' || ?
                  AND c.context != ''
            """,
                (f"%{cleaned_file_path}",),
            )

            for test_context, bitblob in cursor.fetchall():
                if not test_context.endswith("|run"):
                    # for now we're ignoring |setup and |teardown
                    continue

                lines = executed_lines(bitblob)
                if not lines:
                    # test wasn't executed
                    continue

                test_nodeid = test_context.partition("|")[0]
                test_nodeids.add(test_nodeid)

    return test_nodeids


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
        )
    else:
        print(
            f"Calculated {bounded} shards ({test_count} tests ÷ {TESTS_PER_SHARD})",
        )

    return bounded


def main():
    COVERAGE_DB_PATH = os.environ["COVERAGE_DB_PATH"]
    GITHUB_PR_BASE_REF = os.environ["GITHUB_PR_BASE_REF"]

    changed_files = (
        subprocess.check_output(
            (
                "git",
                "diff",
                "--name-only",
                f"{GITHUB_PR_BASE_REF}...HEAD",
            ),
            text=True,
        )
        .strip()
        .splitlines()
    )

    print(f"changed files:\n{'\n'.join(changed_files)}\n")

    selected_tests = select_tests(COVERAGE_DB_PATH, changed_files)
    selected_tests_str = "\n".join(selected_tests)

    with open("selected-tests", "w") as f:
        f.write(selected_tests_str)

    print(f"selected {len(selected_tests)} tests:\n{selected_tests_str}\n\n")

    shard_count = calculate_shards(len(selected_tests))
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
