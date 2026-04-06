#!/usr/bin/env python3
"""Compute which sentry tests to run based on coverage data and changed files.

Uses getsentry's combined coverage DB (downloaded from GCS) to map changed
source files to affected test files. Only outputs sentry tests.

The coverage DB stores sentry paths with a ../sentry/ prefix (relative to
getsentry rootdir). This script handles the translation.

Usage:
    python3 compute-sentry-selected-tests.py \
        --coverage-db .coverage.combined \
        --changed-files "src/sentry/models/organization.py tests/sentry/test_org.py"
"""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
from pathlib import Path

# -- Path conventions --
# The coverage DB stores paths relative to the getsentry rootdir:
#   sentry sources: ../sentry/src/sentry/...
#   sentry tests:   ../sentry/tests/...
DB_PREFIX = "../sentry/"
DB_TEST_PREFIX = "../sentry/tests/"

# Known sentry test directory names.
TEST_DIRS = (
    "tests/sentry/",
    "tests/snuba/",
    "tests/relay_integration/",
    "tests/flagpole/",
    "tests/symbolicator/",
    "tests/social_auth/",
    "tests/sentry_plugins/",
    "tests/integration/",
)

FULL_SUITE_TRIGGERS: list[str | re.Pattern[str]] = [
    "src/sentry/testutils/pytest/sentry.py",
    "src/sentry/constants.py",
    "pyproject.toml",
    "src/sentry/conf/server.py",
    "src/sentry/web/urls.py",
    re.compile(r"/migrations/\d{4}_[^/]+\.py$"),
]

EXCLUDED_TEST_FILES: set[str] = {
    "tests/sentry/test_wsgi.py",
}

EXTRA_FILE_TO_TEST_MAPPING: dict[str, list[str]] = {
    ".github/CODEOWNERS": ["tests/sentry/api/test_api_owners.py"],
}

EXCLUDED_TEST_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^tests/(acceptance|apidocs|js|tools)/"),
]


def _is_test(path: str) -> bool:
    return any(path.startswith(d) for d in TEST_DIRS)


def _matches_trigger(file_path: str, trigger: str | re.Pattern[str]) -> bool:
    if isinstance(trigger, re.Pattern):
        return trigger.search(file_path) is not None
    return file_path == trigger


def _query_coverage(coverage_db_path: str, db_file_paths: list[str]) -> set[str]:
    """Query coverage DB for test contexts covering the given source files."""
    conn = sqlite3.connect(coverage_db_path)
    try:
        cur = conn.cursor()

        tables = {
            r[0]
            for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "line_bits" not in tables or "context" not in tables:
            raise ValueError(
                "Coverage database missing line_bits/context tables. "
                "Coverage must be collected with --cov-context=test"
            )

        test_contexts: set[str] = set()
        for file_path in db_file_paths:
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
            rows = cur.fetchall()
            matched = 0
            for context, bitblob in rows:
                if any(b != 0 for b in bytes(bitblob)):
                    test_contexts.add(context)
                    matched += 1
            if not rows:
                print(f"  No coverage data for: {file_path}")
            elif matched:
                print(f"  {file_path} -> {matched} test context(s)")
    finally:
        conn.close()

    # Extract sentry test file paths from contexts.
    # DB context format: '../sentry/tests/sentry/foo.py::Class::test|run'
    test_files: set[str] = set()
    for context in test_contexts:
        db_path = context.split("::", 1)[0]
        if db_path.startswith(DB_TEST_PREFIX):
            # ../sentry/tests/sentry/foo.py -> tests/sentry/foo.py
            test_files.add(db_path[len(DB_PREFIX) :])

    return test_files


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute selected sentry tests from coverage data")
    parser.add_argument("--coverage-db", required=True, help="Path to coverage SQLite database")
    parser.add_argument(
        "--changed-files",
        required=True,
        help="Space-separated changed files relative to sentry repo root",
    )
    parser.add_argument(
        "--previous-filenames",
        default="",
        help="Space-separated previous filenames for renamed files (queried against coverage DB)",
    )
    parser.add_argument("--output", help="Output file path for selected test files (one per line)")
    parser.add_argument("--github-output", action="store_true", help="Write to GITHUB_OUTPUT")
    args = parser.parse_args()

    coverage_db = Path(args.coverage_db)
    if not coverage_db.exists():
        print(f"Error: Coverage database not found: {coverage_db}", file=sys.stderr)
        return 1

    changed = [f.strip() for f in args.changed_files.split() if f.strip()]
    previous_filenames = [f.strip() for f in args.previous_filenames.split() if f.strip()]

    selective_applied = False

    if not changed:
        print("No changed files provided, running full test suite")
        affected_test_files: set[str] = set()
    else:
        all_paths = changed + previous_filenames
        triggered_by = [
            f for f in all_paths if any(_matches_trigger(f, t) for t in FULL_SUITE_TRIGGERS)
        ]
        if triggered_by:
            print(f"Full test suite triggered by: {', '.join(triggered_by)}")
            affected_test_files = set()
        else:
            selective_applied = True

            # Map repo-relative paths to DB format (add ../sentry/ prefix).
            # Include previous filenames for renames so the coverage DB
            # (which still stores the old path) can find the right tests.
            db_paths = [DB_PREFIX + f for f in changed]
            for old_name in previous_filenames:
                db_paths.append(DB_PREFIX + old_name)

            print(f"Computing selected tests for {len(changed)} changed files...")
            try:
                affected_test_files = _query_coverage(str(coverage_db), db_paths)
            except sqlite3.Error as e:
                print(f"Error querying coverage database: {e}", file=sys.stderr)
                return 1

            affected_test_files -= EXCLUDED_TEST_FILES

            # Extra mapped files
            for f in changed:
                affected_test_files.update(EXTRA_FILE_TO_TEST_MAPPING.get(f, []))

            # Directly changed test files
            changed_tests = {
                f
                for f in changed
                if f.startswith("tests/")
                and f.endswith(".py")
                and not any(p.search(f) for p in EXCLUDED_TEST_PATTERNS)
            }
            existing_changed = {f for f in changed_tests if Path(f).exists()}
            if existing_changed:
                print(f"Including {len(existing_changed)} directly changed test files")
                affected_test_files.update(existing_changed)

    # Filter to sentry tests only (drop any getsentry tests from coverage)
    affected_test_files = {f for f in affected_test_files if _is_test(f)}

    # Filter out deleted test files
    existing_files = {f for f in affected_test_files if Path(f).exists()}
    deleted_files = affected_test_files - existing_files
    if deleted_files:
        print(
            f"Excluding {len(deleted_files)} deleted test file(s): "
            + ", ".join(sorted(deleted_files))
        )
        affected_test_files = existing_files

    output_tests = sorted(affected_test_files)
    print(f"Selected {len(output_tests)} test files")

    if args.output and (output_tests or selective_applied):
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w") as f:
            for test_file in output_tests:
                f.write(f"{test_file}\n")
        print(f"Wrote selected tests to {output_path}")

    if args.github_output:
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            has_selected = bool(output_tests) or selective_applied
            with open(github_output, "a") as f:
                f.write(f"test-count={len(output_tests)}\n")
                f.write(f"has-selected-tests={'true' if has_selected else 'false'}\n")
            print(f"Wrote to GITHUB_OUTPUT: test-count={len(output_tests)}")

    for test_file in output_tests:
        print(f"  {test_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
