from __future__ import annotations

import importlib.util
import os
import subprocess
from pathlib import Path
from types import ModuleType
from unittest import mock

import pytest

SYNC = Path(__file__).parents[2] / "devenv" / "sync.py"


@pytest.fixture
def sync() -> ModuleType:
    spec = importlib.util.spec_from_file_location("sync", SYNC)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_a_stamp_holds_until_its_inputs_change(sync: ModuleType, tmp_path: Path) -> None:
    brewfile = tmp_path / "Brewfile"
    brewfile.write_text("brew 'uv'\n")
    inputs = sync.digest(str(brewfile))
    assert not sync.stamped(str(tmp_path), "brew-bundle", inputs)

    sync.stamp(str(tmp_path), "brew-bundle", inputs)
    assert sync.stamped(str(tmp_path), "brew-bundle", inputs)

    brewfile.write_text("brew 'uv'\nbrew 'watchman'\n")
    assert not sync.stamped(str(tmp_path), "brew-bundle", sync.digest(str(brewfile)))


def test_a_stamp_expires_after_max_age(sync: ModuleType, tmp_path: Path) -> None:
    sync.stamp(str(tmp_path), "agent-skills", "inputs")
    assert sync.stamped(str(tmp_path), "agent-skills", "inputs", max_age=sync.DAY)

    two_days_ago = os.path.getmtime(tmp_path / ".devenv/stamps/agent-skills") - 2 * sync.DAY
    os.utime(tmp_path / ".devenv/stamps/agent-skills", (two_days_ago, two_days_ago))
    assert not sync.stamped(str(tmp_path), "agent-skills", "inputs", max_age=sync.DAY)
    assert sync.stamped(str(tmp_path), "agent-skills", "inputs")


@pytest.fixture
def lockfile(tmp_path: Path) -> str:
    path = tmp_path / "migrations_lockfile.txt"
    path.write_text(
        "Django migrations lock file. This helps us avoid migration conflicts on master.\n"
        "If you have a conflict in this file, it means that someone has committed a migration\n"
        "ahead of you.\n"
        "\n"
        "feedback: 0007_cleanup_failed_safe_deletes\n"
        "\n"
        "sentry: 1000_add_a_column\n"
    )
    return str(path)


def _psql(stdout: str, returncode: int = 0) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess((), returncode, stdout=stdout, stderr="")


def test_migrations_applied_counts_each_apps_latest_migration(
    sync: ModuleType, lockfile: str
) -> None:
    with mock.patch.object(subprocess, "run", return_value=_psql("2\n")) as run:
        assert sync.migrations_applied(("sentry",), (lockfile,))

    (cmd,), _ = run.call_args
    assert cmd[cmd.index("-d") + 1] == "sentry"
    assert cmd[-1] == (
        "select count(*) from django_migrations where (app, name) in "
        "(('feedback', '0007_cleanup_failed_safe_deletes'), ('sentry', '1000_add_a_column'))"
    )


@pytest.mark.parametrize(
    "result",
    [
        _psql("1\n"),
        _psql("", returncode=2),
        FileNotFoundError("docker"),
        subprocess.TimeoutExpired("docker", 10),
    ],
    ids=["a migration is missing", "no database", "no docker", "postgres hangs"],
)
def test_migrations_applied_is_false_unless_postgres_confirms(
    sync: ModuleType, lockfile: str, result: object
) -> None:
    with mock.patch.object(subprocess, "run", side_effect=[result]):
        assert not sync.migrations_applied(("sentry",), (lockfile,))


def test_skills_need_a_lock_and_an_installed_skill(sync: ModuleType, tmp_path: Path) -> None:
    assert not sync.skills_installed(str(tmp_path))

    (tmp_path / "agents.lock").write_text("version = 1\n")
    (tmp_path / ".agents/skills").mkdir(parents=True)
    assert not sync.skills_installed(str(tmp_path))

    (tmp_path / ".agents/skills/commit").mkdir()
    assert sync.skills_installed(str(tmp_path))
