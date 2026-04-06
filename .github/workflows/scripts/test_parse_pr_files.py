#!/usr/bin/env python3
"""Tests for parse-pr-files.py."""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path
from unittest import mock

_script_path = Path(__file__).parent / "parse-pr-files.py"
_spec = importlib.util.spec_from_file_location("parse_pr_files", _script_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["parse_pr_files"] = _mod
_spec.loader.exec_module(_mod)

from parse_pr_files import main

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _run(json_input: str) -> dict[str, str]:
    """Run main() with json_input on stdin, return output as key-value dict."""
    buf = io.StringIO()
    with mock.patch("sys.stdin", io.StringIO(json_input)):
        with mock.patch("sys.stdout", buf):
            main()
    return dict(line.split("=", 1) for line in buf.getvalue().strip().split("\n"))


class TestParsePrFiles:
    def test_real_response_with_rename(self):
        """Vendored fixture from getsentry/sentry#111009 (3 modified + 1 renamed)."""
        fixture = (FIXTURES_DIR / "pr-files-with-rename.json").read_text()
        out = _run(fixture)

        files = out["files"].split()
        assert len(files) == 4
        assert "tests/sentry/hybridcloud/test_cell.py" in files
        assert ".agents/skills/hybrid-cloud-rpc/SKILL.md" in files

        assert out["previous-filenames"] == "tests/sentry/hybridcloud/test_region.py"

    def test_no_renames(self):
        out = _run('[{"filename": "src/foo.py", "status": "modified"}]')
        assert out["files"] == "src/foo.py"
        assert out["previous-filenames"] == ""

    def test_multiple_renames(self):
        out = _run(
            """[
            {"filename": "b.py", "status": "renamed", "previous_filename": "a.py"},
            {"filename": "d.py", "status": "renamed", "previous_filename": "c.py"},
            {"filename": "e.py", "status": "added"}
        ]"""
        )
        assert out["files"] == "b.py d.py e.py"
        assert out["previous-filenames"] == "a.py c.py"

    def test_empty_list(self):
        out = _run("[]")
        assert out["files"] == ""
        assert out["previous-filenames"] == ""

    def test_paginated_response(self):
        """gh api --paginate emits concatenated JSON arrays, one per page."""
        page1 = '[{"filename": "a.py", "status": "modified"}]'
        page2 = '[{"filename": "b.py", "status": "renamed", "previous_filename": "old_b.py"}]'
        out = _run(page1 + page2)
        assert out["files"] == "a.py b.py"
        assert out["previous-filenames"] == "old_b.py"

    def test_paginated_response_with_whitespace(self):
        """Pages may be separated by newlines."""
        page1 = '[{"filename": "a.py", "status": "modified"}]'
        page2 = '[{"filename": "b.py", "status": "added"}]'
        out = _run(page1 + "\n" + page2)
        assert out["files"] == "a.py b.py"
        assert out["previous-filenames"] == ""
