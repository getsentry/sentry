from __future__ import annotations

import os
import sqlite3

from sentry.testutils import pytest

PYTEST_IGNORED_FILES = [
    # the pytest code itself is not part of the test suite but will be referenced by most tests
    "sentry/testutils/pytest/sentry.py",
]


def filter_items_by_coverage(
    config: pytest.Config,
    items: list[pytest.Item],
    changed_files: list[str],
    coverage_db_path: str,
) -> tuple[list[pytest.Item], list[pytest.Item], set[str]]:
    if not os.path.exists(coverage_db_path):
        raise ValueError(f"Coverage database not found at {coverage_db_path}")

    affected_test_files = set()
    try:
        conn = sqlite3.connect(coverage_db_path)
        cur = conn.cursor()

        test_contexts = set()

        for file_path in changed_files:
            if any(file_path.endswith(ignored_file) for ignored_file in PYTEST_IGNORED_FILES):
                continue

            cleaned_file_path = file_path
            if cleaned_file_path.startswith("/src"):
                cleaned_file_path = cleaned_file_path[len("/src") :]

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

            for context, bitblob in cur.fetchall():
                # Check if test was executed
                if any(b != 0 for b in bytes(bitblob)):
                    test_contexts.add(context)

        conn.close()

        # Extract test file paths from contexts
        # Context format: 'tests/foo/bar.py::TestClass::test_function|run'
        test_files = set()
        for context in test_contexts:
            test_file = context.split("::", 1)[0]
            test_files.add(test_file)

    except (sqlite3.Error, Exception) as e:
        raise ValueError(f"Could not query coverage database: {e}")

    config.get_terminal_writer().line(f"Found {len(affected_test_files)} affected test files")
    config.get_terminal_writer().line(f"Affected test files: {affected_test_files}")

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

    return selected_items, discarded_items
