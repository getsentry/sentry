from typing import Any, List, Tuple

import click
from yaml import safe_dump

from sentry.runner.commands.presenters.optionspresenter import OptionsPresenter


class ConsolePresenter(OptionsPresenter):
    """
    Formats and outputs the changes made via sentry configoptions to the
    Console, specifically Click and Logging.
    """

    # These messages are produced more than once and referenced in tests.
    # This is the reason they are constants.
    DRIFT_MSG = "[DRIFT] Option %s drifted and cannot be updated."
    DB_VALUE = "Value of option %s on DB:"
    CHANNEL_UPDATE_MSG = "[CHANNEL UPDATE] Option %s value unchanged. Last update channel updated."
    UPDATE_MSG = "[UPDATE] Option %s updated. Old value: \n%s\nNew value: \n%s"
    SET_MSG = "[SET] Option %s set to value: \n%s"
    UNSET_MSG = "[UNSET] Option %s unset."
    DRY_RUN_MSG = "!!! Dry-run flag on. No update will be performed."
    ERROR_MSG = "Invalid option. %s cannot be updated. Reason %s"
    UNREGISTERED_OPTION_ERROR = "Option %s is not registered, and cannot be updated."
    INVALID_TYPE_ERROR = "Option %s has invalid type. got %s, expected %s."

    def __init__(self) -> None:
        self.drifted_options: List[Tuple[str, Any]] = []
        self.channel_updated_options: List[str] = []
        self.updated_options: List[Tuple[str, Any, Any]] = []
        self.set_options: List[Tuple[str, Any]] = []
        self.unset_options: List[str] = []
        self.not_writable_options: List[Tuple[str, str]] = []
        self.unregistered_options: List[str] = []
        self.invalid_type_options: List[Tuple[str, type, type]] = []

    def flush(self) -> None:
        import logging

        logger = logging.getLogger("sentry.options_automator")

        for key, db_value in self.drifted_options:
            click.echo(self.DRIFT_MSG % key)
            logger.error(self.DRIFT_MSG % key)
            if db_value != "":
                click.echo(self.DB_VALUE % key)
                # This is yaml instead of the python representation as the
                # expected flow, in this case, is to use the output of this
                # line to copy paste it in the config map.
                click.echo(safe_dump(db_value))

        for key in self.channel_updated_options:
            click.echo(self.CHANNEL_UPDATE_MSG % key)

        for key, db_value, value in self.updated_options:
            click.echo(self.UPDATE_MSG % (key, db_value, value))

        for key, value in self.set_options:
            click.echo(self.SET_MSG % (key, value))

        for key in self.unset_options:
            click.echo(self.UNSET_MSG % key)

        for key, reason in self.not_writable_options:
            click.echo(self.ERROR_MSG % (key, reason))

        for key in self.unregistered_options:
            click.echo(self.UNREGISTERED_OPTION_ERROR % key)
            logger.error(self.UNREGISTERED_OPTION_ERROR, key)

        for key, got_type, expected_type in self.invalid_type_options:
            click.echo(self.INVALID_TYPE_ERROR % (key, got_type, expected_type))
            logger.error(self.INVALID_TYPE_ERROR, key, got_type, expected_type)

    def set(self, key: str, value: Any) -> None:
        self.set_options.append((key, value))

    def unset(self, key: str) -> None:
        self.unset_options.append(key)

    def update(self, key: str, db_value: Any, value: Any) -> None:
        self.updated_options.append((key, db_value, value))

    def channel_update(self, key: str) -> None:
        self.channel_updated_options.append(key)

    def drift(self, key: str, db_value: Any) -> None:
        self.drifted_options.append((key, db_value))

    def not_writable(self, key: str, not_writable_reason: str) -> None:
        self.not_writable_options.append((key, not_writable_reason))

    def unregistered(self, key: str) -> None:
        self.unregistered_options.append(key)

    def invalid_type(
        self,
        key: str,
        got_type: type,
        expected_type: type,
    ) -> None:
        self.invalid_type_options.append((key, got_type, expected_type))
