from collections.abc import Generator
from pathlib import Path

import pytest
from django.conf import settings

from sentry import options
from sentry.options.manager import (
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_IMMUTABLE,
    FLAG_PRIORITIZE_DISK,
    UpdateChannel,
)
from sentry.runner.commands.configoptions import configoptions
from sentry.runner.commands.presenters.consolepresenter import ConsolePresenter
from sentry.testutils.cases import CliTestCase


class ConfigOptionsTest(CliTestCase):
    command = configoptions

    @pytest.fixture(autouse=True, scope="class")
    def register_options(self) -> Generator[None]:
        options.register("readonly_option", default=10, flags=FLAG_IMMUTABLE)
        options.register("int_option", default=20, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("str_option", default="blabla", flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("map_option", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("list_option", default=[1, 2], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("drifted_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("change_channel_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("to_unset_option", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register("invalid_type", default=15, flags=FLAG_AUTOMATOR_MODIFIABLE)
        options.register(
            "set_on_disk_option",
            default="",
            flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
        )
        settings.SENTRY_OPTIONS["set_on_disk_option"] = "test"

        yield

        options.unregister("readonly_option")
        options.unregister("int_option")
        options.unregister("str_option")
        options.unregister("map_option")
        options.unregister("list_option")
        options.unregister("drifted_option")
        options.unregister("change_channel_option")
        options.unregister("to_unset_option")
        options.unregister("invalid_type")
        options.unregister("set_on_disk_option")
        del settings.SENTRY_OPTIONS["set_on_disk_option"]

    @pytest.fixture(autouse=True)
    def set_options(self) -> None:
        # These options represent a scenario where we set options otherwise
        # unset.
        options.delete("int_option")
        options.delete("map_option")
        options.delete("list_option")
        # This is the scenario where we change the value of a previously set
        # option.
        options.set("str_option", "old value", channel=UpdateChannel.AUTOMATOR)
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
        options.default_store.delete_cache(options.lookup_key("invalid_type"))

    def test_patch(self):
        def assert_not_set() -> None:
            self._clean_cache()
            assert not options.isset("int_option")
            assert not options.isset("map_option")
            assert not options.isset("list_option")

        def assert_output(rv):
            assert rv.exit_code == 2, rv.output

            # The script produces log lines when DRIFT is detected. This
            # makes it easier to surface these as Sentry errors.

            expected_output = "\n".join(
                [
                    ConsolePresenter.DRIFT_MSG % "drifted_option",
                    ConsolePresenter.DB_VALUE % "drifted_option",
                    "- 1",
                    "- 2",
                    "- 3",
                    "",
                    ConsolePresenter.CHANNEL_UPDATE_MSG % "change_channel_option",
                    ConsolePresenter.UPDATE_MSG % ("str_option", "old value", "new value"),
                    ConsolePresenter.SET_MSG % ("int_option", 40),
                    ConsolePresenter.SET_MSG % ("map_option", {"a": 1, "b": 2}),
                    ConsolePresenter.SET_MSG % ("list_option", [1, 2]),
                ]
            )

            assert expected_output in rv.output

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

        assert rv.exit_code == 2
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
        assert rv.exit_code == 2, rv.output
        expected_output = "\n".join(
            [
                ConsolePresenter.DRIFT_MSG % "drifted_option",
                ConsolePresenter.DB_VALUE % "drifted_option",
                "- 1",
                "- 2",
                "- 3",
                "",
                ConsolePresenter.CHANNEL_UPDATE_MSG % "change_channel_option",
                ConsolePresenter.UPDATE_MSG % ("str_option", "old value", "new value"),
                ConsolePresenter.SET_MSG % ("int_option", 40),
                ConsolePresenter.SET_MSG % ("map_option", {"a": 1, "b": 2}),
                ConsolePresenter.SET_MSG % ("list_option", [1, 2]),
                ConsolePresenter.UNSET_MSG % "to_unset_option",
            ]
        )

        assert expected_output in rv.output

        assert options.get("int_option") == 40
        assert options.get("str_option") == "new value"
        assert options.get("map_option") == {
            "a": 1,
            "b": 2,
        }
        assert options.get("list_option") == [1, 2]
        assert options.get("drifted_option") == [1, 2, 3]

        assert not options.isset("to_unset_option")

    def test_bad_sync(self):
        rv = self.invoke(
            "-f",
            "tests/sentry/runner/commands/badsync.yaml",
            "sync",
        )
        assert rv.exit_code == 2, rv.output

        assert ConsolePresenter.ERROR_MSG % ("set_on_disk_option", "option_on_disk") in rv.output

    def test_sync_unset_options(self):

        # test options set on disk with and without prioritize disk, tracked
        # and not tracked
        # test options set on db, verify that untracked options are properly deleted

        options.delete("drifted_option")

        rv = self.invoke(
            "-f",
            "tests/sentry/runner/commands/unsetsync.yaml",
            "sync",
        )
        assert rv.exit_code == 0, rv.output
        expected_output = "\n".join(
            [
                ConsolePresenter.CHANNEL_UPDATE_MSG % "change_channel_option",
                ConsolePresenter.SET_MSG % ("map_option", {"a": 1, "b": 2}),
                ConsolePresenter.SET_MSG % ("list_option", [1, 2]),
                ConsolePresenter.UNSET_MSG % "str_option",
                ConsolePresenter.UNSET_MSG % "to_unset_option",
            ]
        )

        assert expected_output in rv.output

        assert options.get("int_option") == 20
        assert options.get("str_option") == "blabla"
        assert options.get("map_option") == {
            "a": 1,
            "b": 2,
        }
        assert options.get("list_option") == [1, 2]

        # assert there's no drift after unsetting
        rv = self.invoke(
            "-f",
            "tests/sentry/runner/commands/unsetsync.yaml",
            "sync",
        )
        assert rv.exit_code == 0, rv.output

    def test_bad_patch(self):
        rv = self.invoke(
            "--file=tests/sentry/runner/commands/badpatch.yaml",
            "patch",
        )

        assert rv.exit_code == 2, rv.output

        assert ConsolePresenter.SET_MSG % ("int_option", 50) in rv.output
        assert (
            ConsolePresenter.INVALID_TYPE_ERROR % ("invalid_type", "<class 'list'>", "integer")
            in rv.output
        )
        assert ConsolePresenter.UNREGISTERED_OPTION_ERROR % "inexistent_option" in rv.output

        assert not options.isset("readonly_option")
        assert not options.isset("invalid_type")
        assert options.get("int_option") == 50
