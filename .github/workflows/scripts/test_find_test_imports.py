#!/usr/bin/env python3
from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from find_test_imports import find_test_imports, source_file_to_module

FIXTURES = Path(__file__).parent / "fixtures/test_find_test_imports"


def test_source_file_to_module():
    assert source_file_to_module("src/sentry/foo/bar.py") == "sentry.foo.bar"
    assert source_file_to_module("tests/sentry/test_foo.py") is None
    assert source_file_to_module("src/sentry/foo.ts") is None


def test_finds_direct_importer(tmp_path):
    tests_dir = tmp_path / "tests" / "sentry"
    tests_dir.mkdir(parents=True)
    shutil.copy(FIXTURES / "test_importer.py", tests_dir / "test_importer.py")
    assert find_test_imports(["src/sentry/models/bar.py"], tmp_path) == {
        "tests/sentry/test_importer.py"
    }


def test_ignores_unrelated_files(tmp_path):
    tests_dir = tmp_path / "tests" / "sentry"
    tests_dir.mkdir(parents=True)
    shutil.copy(FIXTURES / "test_unrelated.py", tests_dir / "test_unrelated.py")
    assert find_test_imports(["src/sentry/models/bar.py"], tmp_path) == set()


def test_matches_any_imported_module(tmp_path):
    """A file importing multiple modules is selected if any of the changed files match."""
    tests_dir = tmp_path / "tests" / "sentry"
    tests_dir.mkdir(parents=True)
    shutil.copy(FIXTURES / "test_mixed_imports.py", tests_dir / "test_mixed_imports.py")
    # Only sentry.utils.helpers changed — should still select the file
    result = find_test_imports(["src/sentry/utils/helpers.py"], tmp_path)
    assert result == {"tests/sentry/test_mixed_imports.py"}
    # sentry.models.unrelated did not change — should not select the file
    result = find_test_imports(["src/sentry/models/unrelated.py"], tmp_path)
    assert result == set()


def test_no_tests_dir_returns_empty(tmp_path):
    assert find_test_imports(["src/sentry/models/bar.py"], tmp_path) == set()
