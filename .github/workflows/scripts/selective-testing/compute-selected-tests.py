#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
from pathlib import Path

# Files/patterns that, if matched by any changed file, should trigger the full test suite.
# Strings are matched as suffixes, re.Pattern entries are matched with .search().
FULL_SUITE_TRIGGERS: list[str | re.Pattern[str]] = [
    "sentry/testutils/pytest/sentry.py",
    "pyproject.toml",
    "Makefile",
    "sentry/conf/server.py",
    "sentry/web/urls.py",
    # Django migrations can affect schema and invalidate selective test coverage
    re.compile(r"/migrations/\d{4}_[^/]+\.py$"),
]

# These test files are excluded if they aren't explicitly modified.
EXCLUDED_TEST_FILES: set[str] = {
    # this is selected very frequently since it covers the majority of
    # app warmup, and is almost never actually relevant to changed files
    "tests/sentry/test_wsgi.py",
}

# Non-source files that don't appear in coverage data but have known test
# dependencies.  When one of these files is changed, the mapped test files
# are added to the selected set so selective testing covers them without
# falling back to a full suite run.
EXTRA_FILE_TO_TEST_MAPPING: dict[str, list[str]] = {
    ".github/CODEOWNERS": ["tests/sentry/api/test_api_owners.py"],
}


def _matches_trigger(file_path: str, trigger: str | re.Pattern[str]) -> bool:
    if isinstance(trigger, re.Pattern):
        return trigger.search(file_path) is not None
    return file_path.endswith(trigger)


def should_run_full_suite(changed_files: list[str]) -> bool:
    for file_path in changed_files:
        if any(_matches_trigger(file_path, t) for t in FULL_SUITE_TRIGGERS):
            return True
    return False


# Test directories excluded from backend test runs (must match calculate-backend-test-shards.py)
EXCLUDED_TEST_PATTERNS: list[str | re.Pattern[str]] = [
    re.compile(r"^tests/(acceptance|apidocs|js|tools)/"),
]


def get_changed_test_files(changed_files: list[str]) -> set[str]:
    test_files: set[str] = set()
    for file_path in changed_files:
        if file_path.startswith("tests/") and file_path.endswith(".py"):
            if not any(_matches_trigger(file_path, p) for p in EXCLUDED_TEST_PATTERNS):
                test_files.add(file_path)
    return test_files


def get_affected_test_files(coverage_db_path: str, changed_files: list[str]) -> set[str]:
    affected_test_files: set[str] = set()

    conn = sqlite3.connect(coverage_db_path)
    cur = conn.cursor()

    # Verify required tables exist (need context tracking enabled)
    tables = {
        r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    if "line_bits" not in tables or "context" not in tables:
        raise ValueError(
            "Coverage database missing line_bits/context tables. "
            "Coverage must be collected with --cov-context=test"
        )

    test_contexts: set[str] = set()

    for file_path in changed_files:
        cur.execute(
            """
            SELECT c.context, lb.numbits
            FROM line_bits lb
            JOIN file f    ON lb.file_id = f.id
            JOIN context c ON lb.context_id = c.id
            WHERE f.path LIKE '%' || ?
              AND c.context != ''
        """,
            (f"%{file_path}",),
        )

        for context, bitblob in cur.fetchall():
            if any(b != 0 for b in bytes(bitblob)):
                test_contexts.add(context)

    conn.close()

    # Extract test file paths from contexts
    # Context format: 'tests/foo/bar.py::TestClass::test_function|run'
    for context in test_contexts:
        test_file = context.split("::", 1)[0]
        affected_test_files.add(test_file)

    return affected_test_files


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute selected tests from coverage data")
    parser.add_argument("--coverage-db", required=True, help="Path to coverage SQLite database")
    parser.add_argument(
        "--changed-files", required=True, help="Space-separated list of changed files"
    )
    parser.add_argument("--output", help="Output file path for selected test files (one per line)")
    parser.add_argument("--github-output", action="store_true", help="Write to GITHUB_OUTPUT")
    args = parser.parse_args()

    coverage_db = Path(args.coverage_db)
    if not coverage_db.exists():
        print(f"Error: Coverage database not found: {coverage_db}", file=sys.stderr)
        return 1

    changed_files = [f.strip() for f in args.changed_files.split() if f.strip()]
    if not changed_files:
        print("No changed files provided, running full test suite")
        affected_test_files: set[str] = set()
    elif should_run_full_suite(changed_files):
        triggered_by = [
            f for f in changed_files if any(_matches_trigger(f, t) for t in FULL_SUITE_TRIGGERS)
        ]
        print(f"Full test suite triggered by: {', '.join(triggered_by)}")
        affected_test_files = set()
    else:
        print(f"Computing selected tests for {len(changed_files)} changed files...")
        try:
            affected_test_files = get_affected_test_files(str(coverage_db), changed_files)
        except sqlite3.Error as e:
            print(f"Error querying coverage database: {e}", file=sys.stderr)
            return 1

        affected_test_files -= EXCLUDED_TEST_FILES

        # Include tests for non-source files with known test dependencies
        for file_path in changed_files:
            mapped_tests = EXTRA_FILE_TO_TEST_MAPPING.get(file_path, [])
            if mapped_tests:
                print(f"Including {len(mapped_tests)} mapped test files for {file_path}")
                affected_test_files.update(mapped_tests)

        # Also include test files that were directly modified or added in the PR.
        # Note: we intentionally exclude deleted test files here — they can't be
        # run, and their coverage is already captured by the lookup above (any
        # OTHER test that covered the now-deleted source will be included via
        # get_affected_test_files). Deleted test files that appear in the
        # coverage results are removed by the filter below.
        changed_test_files = get_changed_test_files(changed_files)
        existing_changed_test_files = {f for f in changed_test_files if Path(f).exists()}
        if existing_changed_test_files:
            print(f"Including {len(existing_changed_test_files)} directly changed test files")
            affected_test_files.update(existing_changed_test_files)

    # Filter out any test files found via coverage lookup that no longer exist
    # (e.g. a deleted test file that covered the same source as another changed file).
    existing_files = {f for f in affected_test_files if Path(f).exists()}
    deleted_files = affected_test_files - existing_files
    if deleted_files:
        print(
            f"Excluding {len(deleted_files)} deleted test file(s) found via coverage: "
            + ", ".join(sorted(deleted_files))
        )
        affected_test_files = existing_files

    print(f"Found {len(affected_test_files)} affected test files")

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w") as f:
            for test_file in sorted(affected_test_files):
                f.write(f"{test_file}\n")
        print(f"Wrote selected tests to {output_path}")

    if args.github_output:
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a") as f:
                f.write(f"test-count={len(affected_test_files)}\n")
                f.write(f"has-selected-tests={'true' if affected_test_files else 'false'}\n")
            print(f"Wrote to GITHUB_OUTPUT: test-count={len(affected_test_files)}")

    if affected_test_files:
        print("\nAffected test files:")
        for test_file in sorted(affected_test_files):
            print(f"  {test_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
