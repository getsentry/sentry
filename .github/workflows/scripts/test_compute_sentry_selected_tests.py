#!/usr/bin/env python3
"""Tests for compute-sentry-selected-tests.py."""

from __future__ import annotations

import importlib.util
import os
import sqlite3
import sys
from pathlib import Path
from unittest import mock

import pytest

# Import the dash-named script as a module
_script_path = Path(__file__).parent / "compute-sentry-selected-tests.py"
_spec = importlib.util.spec_from_file_location("compute_sentry_selected_tests", _script_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["compute_sentry_selected_tests"] = _mod
_spec.loader.exec_module(_mod)

from compute_sentry_selected_tests import _query_coverage, main


def _create_coverage_db(path: str, file_to_contexts: dict[str, list[str]]) -> None:
    """Create a minimal coverage DB mapping source files to test contexts."""
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT)")
    cur.execute("CREATE TABLE context (id INTEGER PRIMARY KEY, context TEXT)")
    cur.execute("CREATE TABLE line_bits (file_id INTEGER, context_id INTEGER, numbits BLOB)")

    file_id = 0
    ctx_id = 0
    for file_path, contexts in file_to_contexts.items():
        file_id += 1
        cur.execute("INSERT INTO file VALUES (?, ?)", (file_id, file_path))
        for ctx in contexts:
            ctx_id += 1
            cur.execute("INSERT INTO context VALUES (?, ?)", (ctx_id, ctx))
            cur.execute("INSERT INTO line_bits VALUES (?, ?, ?)", (file_id, ctx_id, b"\x01"))

    conn.commit()
    conn.close()


def _run(args: list[str], env: dict[str, str] | None = None):
    with mock.patch("sys.argv", ["compute-sentry-selected-tests"] + args):
        if env:
            with mock.patch.dict(os.environ, env):
                return main()
        return main()


class TestQueryCoverage:
    def test_sentry_source_maps_to_sentry_tests(self, tmp_path):
        db = str(tmp_path / "coverage.db")
        _create_coverage_db(
            db,
            {
                "../sentry/src/sentry/models/organization.py": [
                    "../sentry/tests/sentry/api/test_organization.py::TestOrg::test_get|run",
                ],
            },
        )
        result = _query_coverage(db, ["../sentry/src/sentry/models/organization.py"])
        assert result == {"tests/sentry/api/test_organization.py"}

    def test_getsentry_tests_excluded(self, tmp_path):
        """Coverage contexts pointing to getsentry tests should be dropped."""
        db = str(tmp_path / "coverage.db")
        _create_coverage_db(
            db,
            {
                "../sentry/src/sentry/models/organization.py": [
                    "tests/getsentry/test_features.py::TestFeatures::test_org|run",
                ],
            },
        )
        result = _query_coverage(db, ["../sentry/src/sentry/models/organization.py"])
        assert result == set()

    def test_missing_tables_raises(self, tmp_path):
        db = str(tmp_path / "coverage.db")
        conn = sqlite3.connect(db)
        conn.execute("CREATE TABLE dummy (id INTEGER)")
        conn.close()
        with pytest.raises(ValueError, match="missing line_bits/context"):
            _query_coverage(db, ["foo.py"])

    def test_zero_bits_excluded(self, tmp_path):
        db = str(tmp_path / "coverage.db")
        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT)")
        cur.execute("CREATE TABLE context (id INTEGER PRIMARY KEY, context TEXT)")
        cur.execute("CREATE TABLE line_bits (file_id INTEGER, context_id INTEGER, numbits BLOB)")
        cur.execute("INSERT INTO file VALUES (1, '../sentry/src/sentry/foo.py')")
        cur.execute(
            "INSERT INTO context VALUES (1, '../sentry/tests/sentry/test_foo.py::T::test|run')"
        )
        cur.execute("INSERT INTO line_bits VALUES (1, 1, ?)", (b"\x00\x00",))
        conn.commit()
        conn.close()
        assert _query_coverage(db, ["../sentry/src/sentry/foo.py"]) == set()


class TestMain:
    def test_no_changed_files_falls_back_to_full_suite(self, tmp_path):
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        _run(
            ["--coverage-db", str(db_path), "--changed-files", "", "--github-output"],
            {"GITHUB_OUTPUT": str(gh_output)},
        )
        assert "has-selected-tests=false" in gh_output.read_text()

    def test_full_suite_trigger(self, tmp_path):
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        _run(
            ["--coverage-db", str(db_path), "--changed-files", "pyproject.toml", "--github-output"],
            {"GITHUB_OUTPUT": str(gh_output)},
        )
        assert "has-selected-tests=false" in gh_output.read_text()

    def test_migration_triggers_full_suite(self, tmp_path):
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        _run(
            [
                "--coverage-db",
                str(db_path),
                "--changed-files",
                "src/sentry/migrations/0042_add_field.py",
                "--github-output",
            ],
            {"GITHUB_OUTPUT": str(gh_output)},
        )
        assert "has-selected-tests=false" in gh_output.read_text()

    def test_selective_returns_matched_tests(self, tmp_path):
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(
            str(db_path),
            {
                "../sentry/src/sentry/models/org.py": [
                    "../sentry/tests/sentry/test_org.py::T::test|run",
                ],
            },
        )
        output = tmp_path / "output.txt"
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        with mock.patch("compute_sentry_selected_tests.Path.exists", return_value=True):
            _run(
                [
                    "--coverage-db",
                    str(db_path),
                    "--changed-files",
                    "src/sentry/models/org.py",
                    "--output",
                    str(output),
                    "--github-output",
                ],
                {"GITHUB_OUTPUT": str(gh_output)},
            )

        gh = gh_output.read_text()
        assert "has-selected-tests=true" in gh
        assert "test-count=1" in gh
        assert output.read_text().strip() == "tests/sentry/test_org.py"

    def test_getsentry_tests_filtered_out(self, tmp_path):
        """Coverage may return getsentry tests — they should be filtered."""
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(
            str(db_path),
            {
                "../sentry/src/sentry/models/org.py": [
                    "../sentry/tests/sentry/test_org.py::T::test|run",
                    "tests/getsentry/test_features.py::T::test|run",
                ],
            },
        )
        output = tmp_path / "output.txt"
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        with mock.patch("compute_sentry_selected_tests.Path.exists", return_value=True):
            _run(
                [
                    "--coverage-db",
                    str(db_path),
                    "--changed-files",
                    "src/sentry/models/org.py",
                    "--output",
                    str(output),
                    "--github-output",
                ],
                {"GITHUB_OUTPUT": str(gh_output)},
            )

        assert "test-count=1" in gh_output.read_text()
        assert output.read_text().strip() == "tests/sentry/test_org.py"

    def test_changed_test_file_included(self, tmp_path):
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        with mock.patch("compute_sentry_selected_tests.Path.exists", return_value=True):
            _run(
                [
                    "--coverage-db",
                    str(db_path),
                    "--changed-files",
                    "tests/sentry/test_new.py",
                    "--output",
                    f"{tmp_path}/output.txt",
                    "--github-output",
                ],
                {"GITHUB_OUTPUT": str(gh_output)},
            )

        gh = gh_output.read_text()
        assert "has-selected-tests=true" in gh
        assert "test-count=1" in gh

    def test_excluded_test_dirs_skipped(self, tmp_path):
        """Tests in acceptance/apidocs/js/tools should not be selected."""
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        with mock.patch("compute_sentry_selected_tests.Path.exists", return_value=True):
            _run(
                [
                    "--coverage-db",
                    str(db_path),
                    "--changed-files",
                    "tests/acceptance/test_foo.py tests/js/test_bar.py",
                    "--github-output",
                ],
                {"GITHUB_OUTPUT": str(gh_output)},
            )

        assert "test-count=0" in gh_output.read_text()

    def test_zero_tests_signals_selective_applied(self, tmp_path):
        """0 tests after filtering should signal 'run nothing', not full suite."""
        db_path = tmp_path / "coverage.db"
        _create_coverage_db(str(db_path), {})
        output = tmp_path / "output.txt"
        gh_output = tmp_path / "gh_output"
        gh_output.write_text("")

        _run(
            [
                "--coverage-db",
                str(db_path),
                "--changed-files",
                "src/sentry/some_new_file.py",
                "--output",
                str(output),
                "--github-output",
            ],
            {"GITHUB_OUTPUT": str(gh_output)},
        )

        gh = gh_output.read_text()
        assert "has-selected-tests=true" in gh
        assert "test-count=0" in gh
        assert output.read_text() == ""

    def test_missing_db_returns_error(self):
        ret = _run(["--coverage-db", "/nonexistent/coverage.db", "--changed-files", "foo.py"])
        assert ret == 1
