from sentry.killswitches import KillswitchInfo
from sentry.runner.commands.killswitches import killswitches
from sentry.testutils import CliTestCase
from sentry.utils.compat import mock

OPTION = "store.load-shed-group-creation-projects"


class KillswitchesTest(CliTestCase):
    command = killswitches

    @mock.patch(
        "sentry.killswitches.ALL_KILLSWITCH_OPTIONS",
        {
            OPTION: KillswitchInfo(
                description="the description", fields={"project_id": "hey", "event_type": "ho"}
            )
        },
    )
    def test_basic(self):
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # the description\n"
            "<disabled entirely>\n"
        )

        PREAMBLE = (
            "# store.load-shed-group-creation-projects: the description\n"
            "# \n"
            "# After saving and exiting, your killswitch conditions will be printed\n"
            "# in faux-SQL for you to confirm.\n"
            "# \n"
            "# Below a template is given for a single condition. The condition's\n"
            "# fields will be joined with AND, while all conditions will be joined\n"
            "# with OR. All fields need to be set, but can be set to null/~, which is\n"
            "# a wildcard.\n"
            "# \n"
            "# - # ho\n"
            "#   event_type: null\n"
            "#   # hey\n"
            "#   project_id: null"
        )

        assert self.invoke("pull", OPTION, "-").output == PREAMBLE

        rv = self.invoke(
            "push", "--yes", OPTION, "-", input=("- project_id: 42\n  event_type: transaction\n")
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # the description\n"
            "DROP DATA WHERE\n"
            "  (project_id = 42 AND event_type = transaction)\n"
        )

        assert self.invoke("pull", OPTION, "-").output == PREAMBLE + (
            "\n" "\n" "- event_type: transaction\n" "  project_id: '42'\n"
        )

        rv = self.invoke(
            "push",
            "--yes",
            OPTION,
            "-",
            input=(
                "- project_id: 42\n"
                "  event_type: transaction\n"
                "- project_id: 43\n"
                "  event_type: ~\n"
            ),
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # the description\n"
            "DROP DATA WHERE\n"
            "  (project_id = 42 AND event_type = transaction) OR\n"
            "  (project_id = 43)\n"
        )

        assert self.invoke("pull", OPTION, "-").output == PREAMBLE + (
            "\n"
            "\n"
            "- event_type: transaction\n"
            "  project_id: '42'\n"
            "- event_type: null\n"
            "  project_id: '43'\n"
        )

        rv = self.invoke(
            "push",
            "--yes",
            OPTION,
            "-",
            input="\n",
        )
        assert rv.exit_code == 0
        assert self.invoke("list").output == (
            "\n"
            "store.load-shed-group-creation-projects\n"
            "  # the description\n"
            "<disabled entirely>\n"
        )

        assert self.invoke("pull", OPTION, "-").output == PREAMBLE
