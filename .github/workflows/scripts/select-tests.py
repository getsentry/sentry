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

IGNORED_FILES = {
    # the pytest code itself is not part of the test suite but will be referenced by most tests
    "sentry/testutils/pytest/sentry.py",
}

IGNORED_NODEIDS = ("tests/sentry/test_wsgi.py::test_wsgi_init",)


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


def select_tests(coverage_db_path: str, changed_files: set[str]):
    test_nodeids = set()

    with sqlite3.connect(coverage_db_path) as conn:
        cursor = conn.cursor()

        file_paths = [
            f"/home/runner/work/sentry/sentry/{file_path}"
            for file_path in changed_files - IGNORED_FILES
        ]

        placeholders = ",".join("?" for _ in file_paths)

        cursor.execute(
            f"""
            SELECT c.context, lb.numbits
            FROM line_bits lb
            JOIN file f    ON lb.file_id = f.id
            JOIN context c ON lb.context_id = c.id
            WHERE f.path IN ({placeholders})
              AND c.context != ''
            """,
            file_paths,
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
            if test_nodeid in IGNORED_NODEIDS:
                continue

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

    selected_tests = select_tests(COVERAGE_DB_PATH, set(changed_files))
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
