from __future__ import annotations

import runpy
import sqlite3
from pathlib import Path

import pytest

_mod = runpy.run_path(
    str(
        Path(__file__).resolve().parents[2]
        / ".github/workflows/scripts/selective-testing/compute-selected-tests.py"
    )
)
should_run_full_suite = _mod["should_run_full_suite"]
get_changed_test_files = _mod["get_changed_test_files"]
get_affected_test_files = _mod["get_affected_test_files"]


def test_full_suite_triggered():
    trigger_files = [
        "sentry/testutils/pytest/sentry.py",
        "src/sentry/testutils/pytest/sentry.py",
        "pyproject.toml",
        "Makefile",
        "sentry/conf/server.py",
        "src/sentry/conf/server.py",
        "sentry/web/urls.py",
        "src/sentry/migrations/0001_initial.py",
        "src/sentry/replays/migrations/0042_add_index.py",
        "src/sentry/issues/migrations/9999_something.py",
    ]
    for path in trigger_files:
        assert should_run_full_suite([path]) is True, path


def test_full_suite_not_triggered():
    safe_files = [
        "src/sentry/migrations/initial.py",
        "src/sentry/utils/migrations_helper.py",
        "src/sentry/migrations/0001_initial.txt",
        "src/sentry/models/group.py",
        "src/sentry/api/endpoints/project.py",
    ]
    for path in safe_files:
        assert should_run_full_suite([path]) is False, path
    assert should_run_full_suite([]) is False
    assert (
        should_run_full_suite(["src/sentry/api/foo.py", "src/sentry/migrations/0500_bar.py"])
        is True
    )


def test_get_changed_test_files():
    changed = [
        "tests/sentry/api/test_base.py",
        "src/sentry/api/base.py",
        "tests/sentry/models/test_group.py",
        "tests/tools/test_compute_selected_tests.py",
        "tests/acceptance/test_foo.py",
        "README.md",
    ]
    assert get_changed_test_files(changed) == {
        "tests/sentry/api/test_base.py",
        "tests/sentry/models/test_group.py",
    }


def test_get_changed_test_files_empty():
    assert get_changed_test_files([]) == set()


def test_get_affected_test_files(tmp_path):
    db_path = tmp_path / ".coverage.combined"
    _create_coverage_db(
        db_path,
        {
            "src/sentry/models/group.py": [
                "tests/sentry/models/test_group.py::TestGroup::test_get|run",
                "tests/sentry/api/test_issues.py::TestIssues::test_list|run",
            ],
            "src/sentry/models/project.py": [
                "tests/sentry/models/test_project.py::TestProject::test_create|run",
            ],
        },
    )

    assert get_affected_test_files(str(db_path), ["src/sentry/models/group.py"]) == {
        "tests/sentry/models/test_group.py",
        "tests/sentry/api/test_issues.py",
    }


def test_get_affected_test_files_no_match(tmp_path):
    db_path = tmp_path / ".coverage.combined"
    _create_coverage_db(
        db_path,
        {
            "src/sentry/models/group.py": [
                "tests/sentry/models/test_group.py::TestGroup::test_get|run"
            ]
        },
    )

    assert get_affected_test_files(str(db_path), ["src/sentry/unrelated.py"]) == set()


def test_get_affected_test_files_missing_tables(tmp_path):
    db_path = tmp_path / ".coverage.combined"
    conn = sqlite3.connect(str(db_path))
    conn.execute("CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT)")
    conn.commit()
    conn.close()

    with pytest.raises(ValueError, match="missing line_bits/context tables"):
        get_affected_test_files(str(db_path), ["src/sentry/models/group.py"])


def _create_coverage_db(db_path, file_contexts):
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT)")
    cur.execute("CREATE TABLE context (id INTEGER PRIMARY KEY, context TEXT)")
    cur.execute("CREATE TABLE line_bits (file_id INTEGER, context_id INTEGER, numbits BLOB)")

    file_id = 0
    ctx_id = 0
    seen_contexts: dict[str, int] = {}

    for file_path, contexts in file_contexts.items():
        file_id += 1
        cur.execute("INSERT INTO file VALUES (?, ?)", (file_id, file_path))
        for ctx in contexts:
            if ctx not in seen_contexts:
                ctx_id += 1
                seen_contexts[ctx] = ctx_id
                cur.execute("INSERT INTO context VALUES (?, ?)", (ctx_id, ctx))
            cur.execute(
                "INSERT INTO line_bits VALUES (?, ?, ?)", (file_id, seen_contexts[ctx], b"\x01")
            )

    cur.execute("INSERT INTO context VALUES (?, ?)", (ctx_id + 1, ""))
    conn.commit()
    conn.close()
