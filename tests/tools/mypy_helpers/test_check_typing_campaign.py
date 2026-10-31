from __future__ import annotations

import contextlib
import subprocess

from tools.mypy_helpers.check_typing_campaign import main


def _git(cwd, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def _init_repo(tmp_path) -> None:
    _git(tmp_path, "init", "-q", "-b", "main")
    _git(tmp_path, "config", "user.email", "test@example.com")
    _git(tmp_path, "config", "user.name", "Test")
    _git(tmp_path, "config", "commit.gpgsign", "false")


def _commit_pyproject(tmp_path, weaklist: list[str]) -> None:
    modules = ", ".join(f'"{module}"' for module in weaklist)
    contents = f"""\
[[tool.mypy.overrides]]
module = [{modules}]
disallow_untyped_defs = false
"""
    tmp_path.joinpath("pyproject.toml").write_text(contents)
    _git(tmp_path, "add", "pyproject.toml")
    _git(tmp_path, "commit", "-q", "-m", "initial")


def _stage_file(tmp_path, path: str, contents: str) -> None:
    file_path = tmp_path / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(contents)
    _git(tmp_path, "add", path)


def test_any_in_graduated_module_fails(tmp_path, capsys) -> None:
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, [])
    _stage_file(
        tmp_path,
        "src/sentry/foo.py",
        "from typing import Any\n\nvalue: Any = 1\n",
    )

    with contextlib.chdir(tmp_path):
        assert main(("src/sentry/foo.py",)) == 1

    assert "new Any in graduated module sentry.foo" in capsys.readouterr().err


def test_any_in_weaklisted_module_passes(tmp_path) -> None:
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, ["sentry.foo"])
    _stage_file(
        tmp_path,
        "src/sentry/foo.py",
        "from typing import Any\n\nvalue: Any = 1\n",
    )

    with contextlib.chdir(tmp_path):
        assert main(("src/sentry/foo.py",)) == 0


def test_trust_boundary_cast_needs_justification(tmp_path, capsys) -> None:
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, [])
    _stage_file(
        tmp_path,
        "src/sentry/foo.py",
        "import json\nfrom typing import cast\n\nvalue = cast(dict[str, int], json.loads('{}'))\n",
    )

    with contextlib.chdir(tmp_path):
        assert main(("src/sentry/foo.py",)) == 1

    assert "needs a '# justification:' comment" in capsys.readouterr().err


def test_trust_boundary_cast_with_justification_passes(tmp_path) -> None:
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, [])
    _stage_file(
        tmp_path,
        "src/sentry/foo.py",
        "import json\nfrom typing import cast\n\n"
        "value = cast(dict[str, int], json.loads('{}'))  # justification: validated shape\n",
    )

    with contextlib.chdir(tmp_path):
        assert main(("src/sentry/foo.py",)) == 0


def test_local_cast_passes(tmp_path) -> None:
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, [])
    _stage_file(
        tmp_path,
        "src/sentry/foo.py",
        "from typing import cast\n\nvalue = cast(str, 'foo')\n",
    )

    with contextlib.chdir(tmp_path):
        assert main(("src/sentry/foo.py",)) == 0
