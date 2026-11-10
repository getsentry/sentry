import os
import sysconfig
from pathlib import Path
from unittest import mock

import click
import pytest
from click.testing import CliRunner

from sentry.runner.main import _COMMANDS, _FALLBACK_ENV, cli


@pytest.fixture
def other_sentry(tmp_path: Path) -> Path:
    binary = tmp_path / "sentry"
    binary.write_text("#!/bin/sh\n")
    binary.chmod(0o755)
    return binary


@pytest.mark.parametrize("name", sorted(_COMMANDS))
def test_lazy_command_imports(name: str) -> None:
    command = cli.get_command(click.Context(cli), name)
    assert isinstance(command, click.Command)


def test_list_commands() -> None:
    names = cli.list_commands(click.Context(cli))
    assert names == sorted({*_COMMANDS, "shell"})


def test_unknown_command_execs_other_sentry(other_sentry: Path) -> None:
    own_bin = sysconfig.get_path("scripts")
    env = {"PATH": os.pathsep.join([own_bin, str(other_sentry.parent)])}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        CliRunner().invoke(cli, ["issue", "list", "--json"])
        assert os.environ[_FALLBACK_ENV] == "1"

    execv.assert_called_once_with(str(other_sentry), ["sentry", "issue", "list", "--json"])


def test_known_command_does_not_exec(other_sentry: Path) -> None:
    env = {"PATH": str(other_sentry.parent)}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        result = CliRunner().invoke(cli, ["config", "--help"])

    assert result.exit_code == 0
    execv.assert_not_called()


def test_unknown_command_errors_without_other_sentry() -> None:
    env = {"PATH": sysconfig.get_path("scripts")}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        result = CliRunner().invoke(cli, ["issue"])

    assert result.exit_code == 2
    assert "No such command 'issue'" in result.output
    execv.assert_not_called()


def test_no_exec_when_already_handed_off(other_sentry: Path) -> None:
    env = {"PATH": str(other_sentry.parent), _FALLBACK_ENV: "1"}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        result = CliRunner().invoke(cli, ["issue"])

    assert result.exit_code == 2
    execv.assert_not_called()
