from __future__ import annotations

import contextlib
import subprocess

import pytest

from tools.mypy_helpers.prevent_weaklist_additions import main


def _git(cwd, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def _init_repo(tmp_path) -> None:
    _git(tmp_path, "init", "-q", "-b", "main")
    _git(tmp_path, "config", "user.email", "test@example.com")
    _git(tmp_path, "config", "user.name", "Test")
    _git(tmp_path, "config", "commit.gpgsign", "false")


def _commit_pyproject(tmp_path, contents: str) -> None:
    tmp_path.joinpath("pyproject.toml").write_text(contents)
    _git(tmp_path, "add", "pyproject.toml")
    _git(tmp_path, "commit", "-q", "-m", "initial")


def test_no_changes_passes(tmp_path) -> None:
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, src)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 0


def test_removal_passes(tmp_path) -> None:
    initial = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f"]
disallow_untyped_defs = false
"""
    updated = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 0


def test_addition_fails(tmp_path, capsys) -> None:
    initial = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    updated = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "x.y.z"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 1

    expected = (
        "pyproject.toml: 'x.y.z' was added to the mypy weaklist — "
        "do not add new modules; fix the typing issues instead.\n"
    )
    assert capsys.readouterr().out == expected


def test_multiple_additions_reported_sorted(tmp_path, capsys) -> None:
    initial = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    updated = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "x.y.z", "p.q.r"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 1

    out = capsys.readouterr().out
    assert "'p.q.r'" in out
    assert "'x.y.z'" in out
    assert out.index("'p.q.r'") < out.index("'x.y.z'")


def test_addition_and_removal_same_diff_only_addition_fails(tmp_path, capsys) -> None:
    initial = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f"]
disallow_untyped_defs = false
"""
    updated = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "x.y.z"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 1

    out = capsys.readouterr().out
    assert "'x.y.z'" in out
    assert "'d.e.f'" not in out


def test_other_overrides_ignored(tmp_path) -> None:
    initial = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    updated = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "new.module.added.to.allowlist"]
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 0


def test_new_file_passes(tmp_path) -> None:
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    tmp_path.joinpath("README.md").write_text("hi")
    _git(tmp_path, "add", "README.md")
    _git(tmp_path, "commit", "-q", "-m", "init")
    tmp_path.joinpath("pyproject.toml").write_text(src)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 0


def test_no_weaklist_section_treated_as_empty(tmp_path) -> None:
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disable_error_code = ["misc"]
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, src)

    with contextlib.chdir(tmp_path):
        assert main(("pyproject.toml",)) == 0


def test_no_filenames_passes(tmp_path) -> None:
    _init_repo(tmp_path)

    with contextlib.chdir(tmp_path):
        assert main(()) == 0


def test_missing_overrides_section_treated_as_empty(tmp_path) -> None:
    initial = """\
[tool.mypy]
strict = true
"""
    updated = """\
[tool.mypy]
strict = true

[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, initial)
    tmp_path.joinpath("pyproject.toml").write_text(updated)

    with contextlib.chdir(tmp_path):
        # HEAD has no overrides at all (treated as empty); staged adds one
        # weaklist module — that's still a new addition relative to HEAD.
        assert main(("pyproject.toml",)) == 1


def test_multiple_weaklist_sections_fails_loudly(tmp_path) -> None:
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c"]
disallow_untyped_defs = false

[[tool.mypy.overrides]]
module = ["d.e.f"]
disallow_untyped_defs = false
"""
    _init_repo(tmp_path)
    _commit_pyproject(tmp_path, src)

    with contextlib.chdir(tmp_path):
        with pytest.raises(SystemExit, match="multiple"):
            main(("pyproject.toml",))
