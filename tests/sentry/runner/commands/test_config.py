from collections.abc import Generator

import pytest
from click.testing import CliRunner

from sentry import options
from sentry.options.manager import FLAG_AUTOMATOR_MODIFIABLE, FLAG_IMMUTABLE, UpdateChannel
from sentry.runner.commands.config import config
from sentry.runner.main import cli
from sentry.testutils.cases import CliTestCase

MSG = "Option: %s. Set: %r. Set in settings: %r. Last channel: %s. Value: %s"


def test_legacy_automator_command_is_unavailable() -> None:
    result = CliRunner().invoke(cli, ["configoptions", "--help"])
    assert result.exit_code == 2
    assert "No such command 'configoptions'" in result.output


class ConfigOptionsTest(CliTestCase):
    command = config

    @pytest.fixture(autouse=True, scope="class")
    def register_options(self) -> Generator[None]:
        options.register("readonly_option", default=10, flags=FLAG_IMMUTABLE)
        options.register("int_option", default=20, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("str_option", default="blabla", flags=FLAG_AUTOMATOR_MODIFIABLE)

        yield

        options.unregister("readonly_option")
        options.unregister("int_option")
        options.unregister("str_option")

    def test_dump(self) -> None:
        options.set("int_option", 30, channel=UpdateChannel.APPLICATION)
        options.set("str_option", "blabla2", channel=UpdateChannel.CLI)

        rv = self.invoke("dump", "-f 2048", "-s")
        assert rv.exit_code == 0, rv.output

        output = "\n".join(
            [
                MSG % ("int_option", True, False, "application", 30),
                MSG % ("str_option", True, False, "cli", "blabla2"),
            ]
        )
        assert output in rv.output
