from __future__ import annotations

from pathlib import Path
from unittest import mock

import pytest

from tools.mypy_helpers import check_strict_typing


def test_compare_accepts_an_unchanged_baseline() -> None:
    baseline = {"src/app.py": {"no-any-return": 2}}
    assert check_strict_typing._compare(baseline, baseline, {"src/app.py"}) == 0


def test_compare_rejects_new_errors(capsys: pytest.CaptureFixture[str]) -> None:
    baseline = {"src/app.py": {"no-any-return": 2}}
    current = {"src/app.py": {"no-any-return": 3}}
    assert check_strict_typing._compare(baseline, current, {"src/app.py"}) == 1
    assert "increased from 2 to 3" in capsys.readouterr().err


def test_compare_requires_lowering_the_baseline(capsys: pytest.CaptureFixture[str]) -> None:
    baseline = {"src/app.py": {"no-any-return": 2}}
    current = {"src/app.py": {"no-any-return": 1}}
    assert check_strict_typing._compare(baseline, current, {"src/app.py"}) == 1
    assert "decreased from 2 to 1" in capsys.readouterr().err


def test_scope_includes_changed_files_and_directories() -> None:
    files = ["src/app.py", "src/other.py", "tests/app.py"]
    assert check_strict_typing._scope(["src/app.py"], files) == {"src/app.py"}
    assert check_strict_typing._scope(["src"], files) == {"src/app.py", "src/other.py"}


def test_normalize_drops_non_python_files() -> None:
    assert check_strict_typing._normalize(["pyproject.toml", "src/app.py", "baseline.json"]) == [
        "src/app.py"
    ]


def test_load_baseline_validates_shape(tmp_path: Path) -> None:
    baseline = tmp_path / "baseline.json"

    baseline.write_text('{"src/app.py": {"no-any-return": 2}}')
    with mock.patch.object(check_strict_typing, "BASELINE", baseline):
        assert check_strict_typing._load_baseline() == {"src/app.py": {"no-any-return": 2}}

    baseline.write_text('{"src/app.py": {"no-any-return": "2"}}')
    with mock.patch.object(check_strict_typing, "BASELINE", baseline):
        with pytest.raises(ValueError):
            check_strict_typing._load_baseline()
