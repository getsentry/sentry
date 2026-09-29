import pytest

from tools import dump_sentry_commands


def test_main(capsys: pytest.CaptureFixture[str]) -> None:
    assert dump_sentry_commands.main() == 0

    commands = capsys.readouterr().out.splitlines()
    assert {"run", "upgrade", "help"} <= set(commands)
    assert commands == sorted(commands)
