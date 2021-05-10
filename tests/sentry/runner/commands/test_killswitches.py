from sentry.killswitches import KillswitchInfo
from sentry.runner.commands.killswitches import killswitches
from sentry.testutils import CliTestCase
from sentry.utils.compat import mock

OPTION = "store.load-shed-group-creation-projects"


class KillswitchesTest(CliTestCase):
    command = killswitches

    @mock.patch(
        "sentry.killswitches.ALL_KILLSWITCH_OPTIONS",
        {OPTION: KillswitchInfo(description="hey", fields=("project_id", "event_type"))},
    )
    @mock.patch("click.edit")
    def test_basic(self, mock_edit):
        assert self.invoke("list").output == (
            "\n" "store.load-shed-group-creation-projects\n" "  # hey\n" "<disabled entirely>\n"
        )

        mock_edit.return_value = "- project_id: 42\n" "  event_type: transaction\n"

        rv = self.invoke("edit", OPTION, input="y\n")
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # hey\n"
            "DROP DATA WHERE\n"
            "  (project_id = 42 AND event_type = transaction)\n"
        )

        mock_edit.return_value = (
            "- project_id: 42\n" "  event_type: transaction\n" "- project_id: 43\n"
        )

        rv = self.invoke(
            "edit",
            OPTION,
            input="y\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # hey\n"
            "DROP DATA WHERE\n"
            "  (project_id = 42 AND event_type = transaction) OR\n"
            "  (project_id = 43)\n"
        )
