from __future__ import annotations

import contextlib
import subprocess
import tomllib
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.mypy_helpers import make_module_ignores, mypy_without_ignores


def _write_project(tmp_path: Path, body: str = "") -> Path:
    path = tmp_path / "pyproject.toml"
    path.write_text(
        "[tool.mypy]\npython_version = '3.13'\n\n"
        "# begin: sentry modules with typing issues\n"
        f"{body}"
        "# end: sentry modules with typing issues\n"
        "\n[tool.ruff]\nline-length = 100\n"
    )
    return path


def _result(stdout: bytes, returncode: int = 0, stderr: bytes = b"") -> subprocess.CompletedProcess[bytes]:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


def _run_generator(
    tmp_path: Path,
    result: subprocess.CompletedProcess[bytes],
) -> tuple[int, str]:
    project = _write_project(tmp_path, "old section\n")
    with patch.object(make_module_ignores.subprocess, "run", return_value=result):
        with contextlib.chdir(tmp_path):
            status = make_module_ignores.main(())
    return status, project.read_text()


def test_generation_keeps_only_error_debt_and_preserves_other_config(
    tmp_path: Path,
) -> None:
    result = _result(
        b"src/sentry/a.py:4: error: bad value [arg-type]\n"
        b"src/sentry/a.py: note: expanded from here\n"
        b"src/sentry/b.py:7: note: Revealed type is 'Any'\n"
        b"Found 1 error in 1 file (checked 2 source files)\n",
        returncode=1,
    )

    status, output = _run_generator(tmp_path, result)

    assert status == 0
    parsed = tomllib.loads(output)
    generated = [
        item
        for item in parsed["tool"]["mypy"]["overrides"]
        if "disable_error_code" in item
    ]
    assert generated == [
        {"module": ["sentry.a"], "disable_error_code": ["arg-type"]}
    ]
    assert "[tool.ruff]\nline-length = 100" in output


def test_zero_error_generation_removes_active_override(
    tmp_path: Path,
) -> None:
    result = _result(
        b"src/sentry/a.py:7: note: Revealed type is 'Any'\n"
        b"Success: no issues found in 1 source file\n"
    )

    status, output = _run_generator(tmp_path, result)

    assert status == 0
    parsed = tomllib.loads(output)
    assert parsed["tool"]["mypy"].get("overrides", []) == []
    assert "# begin: sentry modules with typing issues\n# end:" in output


@pytest.mark.parametrize(
    "result",
    [
        _result(b"Fatal: plugin crashed\n", returncode=2),
        _result(b"Success: no issues found in 0 source files\n", stderr=b"plugin warning"),
        _result(b"", returncode=1),
    ],
)
def test_failed_or_incomplete_checker_does_not_rewrite_config(
    tmp_path: Path,
    result: subprocess.CompletedProcess[bytes],
) -> None:
    project = _write_project(tmp_path, "old section\n")
    original = project.read_text()
    with patch.object(make_module_ignores.subprocess, "run", return_value=result):
        with contextlib.chdir(tmp_path):
            assert make_module_ignores.main(()) == 2
    assert project.read_text() == original


def test_malformed_markers_do_not_rewrite_config(
    tmp_path: Path,
) -> None:
    project = tmp_path / "pyproject.toml"
    project.write_text("# begin: sentry modules with typing issues\n[tool.mypy]\n")
    original = project.read_text()
    with patch.object(
        make_module_ignores.subprocess,
        "run",
        side_effect=lambda *args, **kwargs: pytest.fail("checker must not run for malformed markers"),
    ):
        with contextlib.chdir(tmp_path):
            assert make_module_ignores.main(()) == 2
    assert project.read_text() == original


def test_absent_debt_section_runs_unsuppressed_config(
    tmp_path: Path,
) -> None:
    project = tmp_path / "pyproject.toml"
    project.write_text("[tool.mypy]\npython_version = '3.13'\n")
    seen: list[str] = []

    def run(*args: object, **kwargs: object) -> int:
        command = args[0]
        assert isinstance(command, tuple)
        config_path = Path(command[2])
        seen.append(config_path.read_text())
        return 0

    (tmp_path / ".work/tmp").mkdir(parents=True)
    with patch.object(mypy_without_ignores.subprocess, "call", side_effect=run):
        with contextlib.chdir(tmp_path):
            assert mypy_without_ignores.main(()) == 0
    assert seen == [project.read_text()]
