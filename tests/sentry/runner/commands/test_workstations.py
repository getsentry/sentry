from dataclasses import dataclass
from unittest.mock import MagicMock, Mock, patch

from sentry.runner.commands.workstations import ERR_BIN_NOT_FOUND, workstations
from sentry.testutils.cases import CliTestCase

FAKE_GCLOUD_ERROR = "Fake gcloud error"


class FakePopen(MagicMock):
    @dataclass(frozen=True)
    class Result:
        subcommands: list[str]
        returncode: int = 0
        stdout: str = ""
        stderr: str = ""

    wait = MagicMock()
    terminate = MagicMock()

    def __init__(self, cmd, *args, **kwargs):
        super().__init__(cmd, *args, **kwargs)
        self.args = cmd
        self.stdout = ""
        self.stderr = ""


class WorkstationsTestCase(CliTestCase):
    command = workstations

    @property
    def subcommand(self) -> str:
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    def invoke(self, *args, **kwargs):
        args = (
            self.subcommand,
            *args,
            *self.default_args,
            *("--project", "fake"),
        )
        return self.runner.invoke(self.command, args, obj={}, **kwargs)


@patch("shutil.which", return_value="/fake/path/to/gcloud/bin")
@patch("subprocess.Popen", new_callable=lambda: FakePopen)
class GcloudCheckTests(WorkstationsTestCase):
    """
    Check that we correctly report underlying `gcloud` problems.
    """

    # We could use any command here, so we go with `configs` since it is the simplest.
    subcommand = "configs"

    def test_bad_missing_binary(self, _: FakePopen, which_mock: Mock) -> None:
        which_mock.return_value = None
        rv = self.invoke()
        assert rv.exit_code == 1
        assert rv.output.strip() == ERR_BIN_NOT_FOUND.strip()


@patch("shutil.which", return_value="/fake/path/to/gcloud/bin")
@patch(
    "subprocess.Popen",
    new_callable=lambda: FakePopen,
)
class ConfigsTests(WorkstationsTestCase):
    subcommand = "configs"
