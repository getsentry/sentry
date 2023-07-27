from typing import List

import click

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter
from sentry.runner.decorators import configuration, log_options


class ConsolePresenter(OptionsPresenter):
    @log_options()
    @configuration
    def error(key: str, not_writable_reason: str):
        click.echo(f"Invalid option. {key} cannot be updated. Reason {not_writable_reason}")

    @log_options()
    @configuration
    def write(
        drifted: List[str],
        channel_updated: List[str],
        updated: List[(str, str, str)],
        set_options: List[(str, str)],
        unset: List[str],
    ):

        for key in drifted:
            click.echo(OptionsPresenter.DRIFT_MSG % key)

        for key in channel_updated:
            click.echo(OptionsPresenter.CHANNEL_UPDATE_MSG % key)

        for key, db_value, value in updated:
            click.echo(OptionsPresenter.UPDATE_MSG % (key, db_value, value))

        for key, value in set_options:
            click.echo(OptionsPresenter.SET_MSG % (key, value))

        for key in unset:
            click.echo(OptionsPresenter.UNSET_MSG % key)
