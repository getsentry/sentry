from sentry.runner.commands.killswitches import killswitches
from sentry.testutils import CliTestCase
from sentry.utils.compat import mock

OPTION = "store.load-shed-group-creation-projects"


class KillswitchesTest(CliTestCase):
    command = killswitches

    @mock.patch("sentry.killswitches.ALL_KILLSWITCH_OPTIONS", [OPTION])
    def test_basic(self):
        assert self.invoke("list").output == (
            "store.load-shed-group-creation-projects: <disabled entirely>\n"
        )

        rv = self.invoke(
            "add-condition",
            "--killswitch",
            OPTION,
            "--field",
            "project_id",
            "--value",
            "42",
            input="y\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "store.load-shed-group-creation-projects: DROP DATA WHERE\n" "  project_id IN ['42']\n"
        )

        rv = self.invoke(
            "add-condition",
            "--killswitch",
            OPTION,
            "--field",
            "project_id",
            "--value",
            "43",
            input="y\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "store.load-shed-group-creation-projects: DROP DATA WHERE\n"
            "  project_id IN ['42', '43']\n"
        )

        rv = self.invoke(
            "add-condition",
            "--killswitch",
            OPTION,
            "--field",
            "event_type",
            "--value",
            "transaction",
            input="y\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "store.load-shed-group-creation-projects: DROP DATA WHERE\n"
            "  project_id IN ['42', '43'] AND\n"
            "  event_type IN ['transaction']\n"
        )

        rv = self.invoke(
            "remove-condition",
            "--killswitch",
            OPTION,
            "--field",
            "event_type",
            "--value",
            "transaction",
            input="y\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "store.load-shed-group-creation-projects: DROP DATA WHERE\n"
            "  project_id IN ['42', '43']\n"
        )

        rv = self.invoke(
            "remove-condition",
            "--killswitch",
            OPTION,
            "--field",
            "event_type",
            "--value",
            "transaction",
            input="y\n",
        )
        assert rv.exit_code == 1
        assert rv.output == "No changes!\nAborted!\n"
