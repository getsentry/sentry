from pathlib import Path

import pytest

from sentry import options
from sentry.options.manager import FLAG_AUTOMATOR_MODIFIABLE, FLAG_IMMUTABLE, UpdateChannel
from sentry.runner.commands.configoptions import (
    CHANNEL_UPDATE_MSG,
    DB_VALUE,
    DRIFT_MSG,
    UNSET_MSG,
    UPDATE_MSG,
    configoptions,
)
from sentry.testutils import CliTestCase


class ConfigOptionsTest(CliTestCase):
    command = configoptions

    @pytest.fixture(autouse=True, scope="class")
    def register_options(self) -> None:
        options.register("readonly_option", default=10, flags=FLAG_IMMUTABLE)
        options.register("int_option", default=20, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("str_option", default="blabla", flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("map_option", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("list_option", default=[1, 2], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("drifted_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("change_channel_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("to_unset_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

    @pytest.fixture(autouse=True)
    def set_options(self) -> None:
        options.delete("int_option")
        options.delete("str_option")
        options.delete("map_option")
        options.delete("list_option")
        # This option will test the drift scenario. We set it to a different
        # value with respect to the file.
        options.set("drifted_option", [1, 2, 3], channel=UpdateChannel.CLI)
        # This tests the scenario were we update the channel. The value
        # is the same we have in the file.
        options.set("change_channel_option", [5, 6, 7], channel=UpdateChannel.CLI)
        # This test the scenario where options are unset.
        options.set("to_unset_option", [7, 8, 9], channel=UpdateChannel.AUTOMATOR)

    def _clean_cache(self) -> None:
        """
        The isset method returns true even if the option is not set
        in the DB but still present in cache after a call to `get`.
        Till we fix that behavior, we need to clean up the cache
        when we run this test.
        """
        options.default_store.flush_local_cache()

        options.default_store.delete_cache(options.lookup_key("int_option"))
        options.default_store.delete_cache(options.lookup_key("str_option"))
        options.default_store.delete_cache(options.lookup_key("map_option"))
        options.default_store.delete_cache(options.lookup_key("list_option"))
        options.default_store.delete_cache(options.lookup_key("drifted_option"))
        options.default_store.delete_cache(options.lookup_key("change_channel_option"))

    def test_patch(self):
        def assert_not_set() -> None:
            self._clean_cache()
            assert not options.isset("int_option")
            assert not options.isset("str_option")
            assert not options.isset("map_option")
            assert not options.isset("list_option")

        def assert_output(rv):
            assert rv.exit_code == 0, rv.output
            output = "\n".join(
                [
                    UPDATE_MSG % "int_option",
                    UPDATE_MSG % "str_option",
                    UPDATE_MSG % "map_option",
                    UPDATE_MSG % "list_option",
                    DRIFT_MSG % "drifted_option",
                    DB_VALUE % "drifted_option",
                    "- 1",
                    "- 2",
                    "- 3",
                    "",
                    CHANNEL_UPDATE_MSG % "change_channel_option",
                ]
            )
            assert output in rv.output

        assert_not_set()
        rv = self.invoke(
            "--dry-run",
            "--file=tests/sentry/runner/commands/valid_patch.yaml",
            "patch",
        )
        assert_output(rv)

        assert_not_set()

        rv = self.invoke(
            "--file=tests/sentry/runner/commands/valid_patch.yaml",
            "patch",
        )
        assert_output(rv)

        assert options.get("int_option") == 40
        assert options.get("str_option") == "new value"
        assert options.get("map_option") == {
            "a": 1,
            "b": 2,
        }
        assert options.get("list_option") == [1, 2]
        assert options.get("drifted_option") == [1, 2, 3]

    def test_stdin(self):
        rv = self.invoke(
            "patch",
            input=Path(
                "tests/sentry/runner/commands/valid_patch.yaml",
            ).read_text(),
        )

        assert rv.exit_code == 0
        assert options.get("int_option") == 40
        assert options.get("str_option") == "new value"
        assert options.get("map_option") == {
            "a": 1,
            "b": 2,
        }
        assert options.get("list_option") == [1, 2]
        assert options.get("drifted_option") == [1, 2, 3]

    def test_sync(self):
        rv = self.invoke(
            "-f",
            "tests/sentry/runner/commands/valid_patch.yaml",
            "sync",
        )
        assert rv.exit_code == 0, rv.output
        output = "\n".join(
            [
                UPDATE_MSG % "int_option",
                UPDATE_MSG % "str_option",
                UPDATE_MSG % "map_option",
                UPDATE_MSG % "list_option",
                DRIFT_MSG % "drifted_option",
                DB_VALUE % "drifted_option",
                "- 1",
                "- 2",
                "- 3",
                "",
                CHANNEL_UPDATE_MSG % "change_channel_option",
                UNSET_MSG % "to_unset_option",
            ]
        )

        assert output in rv.output

        assert options.get("int_option") == 40
        assert options.get("str_option") == "new value"
        assert options.get("map_option") == {
            "a": 1,
            "b": 2,
        }
        assert options.get("list_option") == [1, 2]
        assert options.get("drifted_option") == [1, 2, 3]

        assert not options.isset("to_unset_option")

    def test_bad_patch(self):
        rv = self.invoke(
            "--file=tests/sentry/runner/commands/badpatch.yaml",
            "patch",
        )
        assert rv.exit_code == -1
        assert "Invalid option. readonly_option cannot be updated. Reason readonly" in rv.output
        # Verify this was not updated
        assert options.get("int_option") == 20
