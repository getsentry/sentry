#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Files that, if changed, should trigger the full test suite (can't determine affected tests)
FULL_SUITE_TRIGGER_FILES = [
    "sentry/testutils/pytest/sentry.py",
    "pyproject.toml",
    # "Makefile",
    "sentry/conf/server.py",
    "sentry/web/urls.py",
]


def should_run_full_suite(changed_files: list[str]) -> bool:
    for file_path in changed_files:
        if any(file_path.endswith(trigger) for trigger in FULL_SUITE_TRIGGER_FILES):
            return True
    return False


def get_changed_test_files(changed_files: list[str]) -> set[str]:
    test_files: set[str] = set()
    for file_path in changed_files:
        # Match test files in the tests/ directory
        if file_path.startswith("tests/") and file_path.endswith(".py"):
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
            f for f in changed_files if any(f.endswith(t) for t in FULL_SUITE_TRIGGER_FILES)
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

        # Also include any test files that were directly changed/added in the PR
        changed_test_files = get_changed_test_files(changed_files)
        if changed_test_files:
            print(f"Including {len(changed_test_files)} directly changed test files")
            affected_test_files.update(changed_test_files)

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
