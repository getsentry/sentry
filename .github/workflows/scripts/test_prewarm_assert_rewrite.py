from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from _pytest.assertion.rewrite import PYC_TAIL, _read_pyc

_mod = importlib.import_module("prewarm_assert_rewrite")


def test_prewarm_writes_pycs_pytest_reads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "src/sentry/testutils").mkdir(parents=True)
    (tmp_path / "src/sentry/testutils/cases.py").write_text("X = 1\n")
    (tmp_path / "tests/a").mkdir(parents=True)
    (tmp_path / "tests/conftest.py").write_text("")
    (tmp_path / "tests/a/test_one.py").write_text("def test_x():\n    assert [1] == [2]\n")
    (tmp_path / "tests/a/helper.py").write_text("")
    file_list = tmp_path / "files.txt"
    file_list.write_text("tests/a/test_one.py\ntests/a/helper.py\n")

    targets = _mod.rewrite_targets(file_list.read_text().split())
    assert targets == [
        Path("src/sentry/testutils/cases.py"),
        Path("tests/conftest.py"),
        Path("tests/a/test_one.py"),
    ]

    assert _mod.main(str(file_list)) == 0
    for path in targets:
        pyc = path.parent / "__pycache__" / (path.name[:-3] + PYC_TAIL)
        assert _read_pyc(path, pyc, lambda msg: None) is not None
