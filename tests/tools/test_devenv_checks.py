from __future__ import annotations

import importlib.util
import os
from collections.abc import Generator
from pathlib import Path
from types import ModuleType
from unittest import mock

import pytest

CHECK = Path(__file__).parents[2] / "devenv" / "checks" / "synced.py"


@pytest.fixture
def synced(tmp_path: Path) -> Generator[ModuleType]:
    spec = importlib.util.spec_from_file_location("synced", CHECK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    (tmp_path / ".node-version").write_text("26.12.1\n")
    with mock.patch.object(module, "reporoot", str(tmp_path)), mock.patch.dict(os.environ):
        os.environ.pop("SENTRY_DEVENV_SKIP_FRONTEND", None)
        yield module


def _executable(path: Path, body: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"#!/bin/sh\n{body}\n")
    os.chmod(path, 0o755)


def test_unsynced_checkout(synced: ModuleType) -> None:
    ok, msg = synced.check()
    assert not ok
    assert msg == (
        "sentry isn't installed in .venv; prek isn't installed in .venv; "
        "node isn't installed in .devenv/bin; pnpm packages aren't installed"
    )


def test_synced_checkout(synced: ModuleType, tmp_path: Path) -> None:
    _executable(tmp_path / ".venv/bin/sentry")
    _executable(tmp_path / ".venv/bin/prek")
    _executable(tmp_path / ".devenv/bin/node", "echo v26.12.1")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "agents.toml").touch()
    (tmp_path / "agents.lock").write_text("lock\n")
    (tmp_path / ".agents/skills/some-skill").mkdir(parents=True)
    assert synced.check() == (True, "")


def test_wrong_node_and_missing_skills(synced: ModuleType, tmp_path: Path) -> None:
    _executable(tmp_path / ".venv/bin/sentry")
    _executable(tmp_path / ".venv/bin/prek")
    _executable(tmp_path / ".devenv/bin/node", "echo v20.0.0")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "agents.toml").touch()
    assert synced.check() == (
        False,
        "agent skills aren't installed; node is v20.0.0, expected v26.12.1",
    )


def test_skip_frontend(synced: ModuleType, tmp_path: Path) -> None:
    os.environ["SENTRY_DEVENV_SKIP_FRONTEND"] = "1"
    _executable(tmp_path / ".venv/bin/sentry")
    _executable(tmp_path / ".venv/bin/prek")
    assert synced.check() == (True, "")
