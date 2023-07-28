from typing import Any

import click

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter


class ConsolePresenter(OptionsPresenter):

    # These messages are produced more than once and referenced in tests.
    # This is the reason they are constants.

    DRIFT_MSG = "[DRIFT] Option %s drifted and cannot be updated."
    DB_VALUE = "Value of option %s on DB:"
    CHANNEL_UPDATE_MSG = "[CHANNEL UPDATE] Option %s value unchanged. Last update channel updated."
    UPDATE_MSG = "[UPDATE] Option %s updated. Old value: \n%s\nNew value: \n%s"
    SET_MSG = "[SET] Option %s set to value: \n%s"
    UNSET_MSG = "[UNSET] Option %s unset."
    DRY_RUN_MSG = "!!! Dry-run flag on. No update will be performed."

    def __init__(self, dry_run) -> None:
        self.drifted_options = []
        self.channel_updated_options = []
        self.updated_options = []
        self.set_options = []
        self.unset_options = []
        self.error_options = []
        self.dry_run = dry_run

    def flush(self):
        for key, db_value in self.drifted_options:
            click.echo(self.DRIFT_MSG % key)
            if db_value:
                # This is yaml instead of the python representation as the
                # expected flow, in this case, is to use the output of this
                # line to copy paste it in the config map.
                click.echo(db_value)

        for key in self.channel_updated_options:
            click.echo(self.CHANNEL_UPDATE_MSG % key)

        for key, db_value, value in self.updated_options:
            click.echo(self.UPDATE_MSG % (key, db_value, value))

        for key, value in self.set_options:
            click.echo(self.SET_MSG % (key, value))

        for key in self.unset_options:
            click.echo(self.UNSET_MSG % key)

        for key, reason in self.error_options:
            click.echo(f"Invalid option. {key} cannot be updated. Reason {reason}")

    def set(self, key: str, value: Any):
        self.set_options.append((key, value))

    def unset(self, key: str):
        self.unset_options.append(key)

    def update(self, key: str, db_value: Any, value: Any):
        self.update_options.append((key, db_value, value))

    def channel_update(self, key: str):
        self.channel_updated_options.append(key)

    def drift(self, key: str, db_value: Any):
        self.drifted_options((key, db_value))

    def error(self, key: str, not_writable_reason: str):
        self.error_options.append((key, not_writable_reason))
