import os
import pkgutil
import sysconfig
from pathlib import Path
from unittest import mock

import click
import pytest
from click.shell_completion import _resolve_context
from click.testing import CliRunner

from sentry.runner import commands
from sentry.runner.main import _FALLBACK_ENV, _module_commands, _SentryGroup, cli


@pytest.fixture
def other_sentry(tmp_path: Path) -> Path:
    binary = tmp_path / "sentry"
    binary.write_text("#!/bin/sh\n")
    binary.chmod(0o755)
    return binary


@pytest.mark.parametrize(
    "module",
    [m.name for m in pkgutil.iter_modules(commands.__path__) if not m.ispkg],
)
def test_every_command_module_has_its_command(module: str) -> None:
    assert _module_commands(f"{commands.__name__}.{module}")


def test_listed_commands_resolve_lazily() -> None:
    names = cli.list_commands(click.Context(cli))
    assert "devserver" in names
    assert "write-hashes" in names
    assert "shell" in names

    group = _SentryGroup(commands={"shell": cli.commands["shell"]})
    for name in names:
        command = group.get_command(click.Context(group), name)
        assert command is not None and command.name == name


@pytest.mark.parametrize("name", ["presenters", "write_hashes", "import_", "foo.bar", "../x"])
def test_non_command_names_do_not_resolve(name: str) -> None:
    assert cli.get_command(click.Context(cli), name) is None


def test_unknown_command_execs_other_sentry(other_sentry: Path) -> None:
    own_bin = sysconfig.get_path("scripts")
    env = {"PATH": os.pathsep.join([own_bin, str(other_sentry.parent)])}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        CliRunner().invoke(cli, ["issue", "list", "--json"])
        assert os.environ[_FALLBACK_ENV] == "1"

    execv.assert_called_once_with(str(other_sentry), ["sentry", "issue", "list", "--json"])


@pytest.mark.parametrize(
    ("argv", "handoff"),
    [
        (["--verbose", "issue", "list"], ["--verbose", "issue", "list"]),
        (["--config", "conf", "--verbose", "issue"], ["--verbose", "issue"]),
        (["--config=conf", "--verbose", "issue"], ["--verbose", "issue"]),
    ],
)
def test_unknown_leading_option_execs_other_sentry(
    other_sentry: Path, argv: list[str], handoff: list[str]
) -> None:
    env = {"PATH": str(other_sentry.parent)}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        CliRunner().invoke(cli, argv)

    execv.assert_called_once_with(str(other_sentry), ["sentry", *handoff])


@pytest.mark.parametrize("argv", [["--help"], ["--config", "--verbose", "--help"]])
def test_server_options_do_not_exec(other_sentry: Path, argv: list[str]) -> None:
    env = {"PATH": str(other_sentry.parent)}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        result = CliRunner().invoke(cli, argv)

    assert result.exit_code == 0
    execv.assert_not_called()


@pytest.mark.parametrize("argv", [["issue", "li"], ["--verbose", "issue"]])
def test_completion_does_not_exec(other_sentry: Path, argv: list[str]) -> None:
    env = {"PATH": str(other_sentry.parent)}
    with mock.patch.dict(os.environ, env), mock.patch("os.execv") as execv:
        _resolve_context(cli, {}, "sentry", argv)

    execv.assert_not_called()


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
