from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Generator, Sequence
from typing import Any
from unittest import mock

import pytest

from tools import dev_db


class FakeRun:
    def __init__(self, fail: dict[str, tuple[int, str]] | None = None) -> None:
        self.calls: list[tuple[str, ...]] = []
        self.fail = fail or {}

    def __call__(self, cmd: Sequence[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        cmd = tuple(cmd)
        self.calls.append(cmd)
        returncode, stderr = self.fail.get(cmd[-1], (0, ""))
        if returncode and kwargs.get("check"):
            raise subprocess.CalledProcessError(returncode, cmd)
        return subprocess.CompletedProcess(cmd, returncode, "", stderr)


@pytest.fixture
def fake_run() -> Generator[FakeRun]:
    fake = FakeRun()
    with mock.patch.object(subprocess, "run", fake), mock.patch.dict(os.environ):
        os.environ.pop("GITHUB_ACTIONS", None)
        yield fake


def _summary(calls: list[tuple[str, ...]]) -> list[tuple[str, ...]]:
    out: list[tuple[str, ...]] = []
    for cmd in calls:
        if cmd[0] == "docker":
            out.append((cmd[3], cmd[-1]))
        else:
            assert cmd[:3] == (sys.executable, "-m", "sentry")
            out.append(cmd[3:5])
    return out


def test_migrate_creates_every_database_then_upgrades(fake_run: FakeRun) -> None:
    assert dev_db.main(("migrate",)) == 0
    assert _summary(fake_run.calls) == [
        ("createdb", "sentry"),
        ("createdb", "control"),
        ("createdb", "region"),
        ("createdb", "secondary"),
        ("upgrade", "--noinput"),
    ]


def test_reset_is_ordered(fake_run: FakeRun) -> None:
    assert dev_db.main(("reset",)) == 0
    assert _summary(fake_run.calls) == [
        ("dropdb", "sentry"),
        ("dropdb", "control"),
        ("dropdb", "region"),
        ("dropdb", "secondary"),
        ("createdb", "sentry"),
        ("createdb", "control"),
        ("createdb", "region"),
        ("createdb", "secondary"),
        ("upgrade", "--noinput"),
        ("createuser", "--superuser"),
    ]
    assert "admin@sentry.io" in fake_run.calls[-1]


def test_reset_in_ci_creates_passwordless_user(fake_run: FakeRun) -> None:
    os.environ["GITHUB_ACTIONS"] = "true"
    assert dev_db.main(("reset",)) == 0
    assert fake_run.calls[-1][-4:] == ("--email", "foo@tbd.com", "--no-password", "--no-input")


def test_create_tolerates_existing_database(fake_run: FakeRun) -> None:
    fake_run.fail["sentry"] = (
        1,
        'createdb: error: database creation failed: ERROR:  database "sentry" already exists\n',
    )
    assert dev_db.main(("create",)) == 0
    assert len(fake_run.calls) == 4


def test_create_propagates_other_failures(
    fake_run: FakeRun, capsys: pytest.CaptureFixture[str]
) -> None:
    fake_run.fail["control"] = (1, "Error response from daemon: container is not running\n")
    assert dev_db.main(("migrate",)) == 1
    assert _summary(fake_run.calls) == [("createdb", "sentry"), ("createdb", "control")]
    assert "container is not running" in capsys.readouterr().err


def test_migrate_propagates_upgrade_failure(fake_run: FakeRun) -> None:
    fake_run.fail["--noinput"] = (3, "")
    assert dev_db.main(("migrate",)) == 3
