# flake8: noqa: S002

from __future__ import annotations

import os
import sqlite3
import sys


def _file_executed(bitblob: bytes) -> bool:
    """
    Returns True if any line in the file was executed (bitblob has any bits set).
    """
    return any(b != 0 for b in bitblob)


def get_affected_tests_from_coverage(db_path: str, source_files: list[str]) -> set[str] | None:
    """
    Query the coverage database to find which tests executed code in the given source files.

    Args:
        db_path: Path to the .coverage SQLite database
        source_files: List of source file paths that have changed

    Returns:
        Set of test file paths (e.g., 'tests/sentry/api/test_foo.py'),
        or None if the database doesn't exist or there's an error.
    """
    if not os.path.exists(db_path):
        return None

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        test_contexts = set()

        for file_path in source_files:
            if file_path.endswith("sentry/testutils/pytest/sentry.py"):
                continue
            cleaned_file_path = file_path
            if cleaned_file_path.startswith("/src"):
                cleaned_file_path = cleaned_file_path[len("/src") :]
            # Query for test contexts that executed this file

            print(f"Querying coverage database for {cleaned_file_path}")
            cur.execute(
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

            print(f"Found {len(cur.fetchall())} contexts for {cleaned_file_path}")

            for context, bitblob in cur.fetchall():
                if _file_executed(bitblob):
                    print(f"Found executed context: {context}")
                    test_contexts.add(context)

        conn.close()

        # Extract test file paths from contexts
        # Context format: 'tests/foo/bar.py::TestClass::test_function'
        test_files = set()
        for context in test_contexts:
            test_file = context.split("::", 1)[0]
            test_files.add(test_file)

        return test_files

    except (sqlite3.Error, Exception) as e:
        # Log the error but don't fail the test run

        print(f"Warning: Could not query coverage database: {e}", file=sys.stderr)
        return None


def filter_items_by_coverage(items, changed_files: list[str], coverage_db_path: str):
    """
    Filter pytest items to only include tests affected by the changed files.

    Args:
        items: List of pytest.Item objects to filter
        changed_files: List of source files that have changed
        coverage_db_path: Path to the coverage database

    Returns:
        Tuple of (selected_items, discarded_items, affected_test_files)
        where affected_test_files is the set of test files found in coverage data,
        or None if coverage data could not be loaded.
    """
    affected_test_files = get_affected_tests_from_coverage(coverage_db_path, changed_files)
    print(f"Affected test files: {affected_test_files}")

    if affected_test_files is None:
        # Could not load coverage data, return all items as selected
        return list(items), [], None

    # Filter items to only include tests from affected files
    selected_items = []
    discarded_items = []

    for item in items:
        # Extract test file path from nodeid (e.g., 'tests/foo.py::TestClass::test_func')
        test_file = item.nodeid.split("::", 1)[0]
        if test_file in affected_test_files:
            selected_items.append(item)
        else:
            discarded_items.append(item)

    return selected_items, discarded_items, affected_test_files
