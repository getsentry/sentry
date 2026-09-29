import pytest

from sentry.build import dump_cli_commands


def test_main(capsys: pytest.CaptureFixture[str]) -> None:
    assert dump_cli_commands.main() == 0

    commands = capsys.readouterr().out.splitlines()
    assert {"run", "upgrade", "help"} <= set(commands)
    assert commands == sorted(commands)
