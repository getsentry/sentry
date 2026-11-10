import click
import pytest

from sentry.runner.main import _COMMANDS, cli


@pytest.mark.parametrize("name", sorted(_COMMANDS))
def test_lazy_command_imports(name: str) -> None:
    command = cli.get_command(click.Context(cli), name)
    assert isinstance(command, click.Command)


def test_list_commands() -> None:
    names = cli.list_commands(click.Context(cli))
    assert names == sorted({*_COMMANDS, "shell"})
