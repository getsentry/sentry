from typing import TYPE_CHECKING, Any, Mapping, Set

import click
import yaml

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from sentry.options import NotWritableReason


DRIFT_MSG = "[DRIFT] Option %s drifted and cannot be updated."
CHANNEL_UPDATE_MSG = "[CHANNEL UPDATE] Option: %s value unchanged. Last update channel updated."
UPDATE_MSG = "[UPDATE] Option: %s updated."
UNSET_MSG = "[UNSET] Option %s unset."


class InvalidOption(Exception):
    def __init__(self, key: str, reason: "NotWritableReason") -> None:
        super.__init__(f"Invalid Option: {key}. Reason: {key}")
        self.key = key
        self.reason = reason


def _validate_options(content: Mapping[str, Any]) -> Set[str]:
    from sentry import options

    drifted_options = set()

    for key, value in content.items():
        not_writable_reason = options.can_update(key, value, options.UpdateChannel.AUTOMATOR)

        if not_writable_reason and not_writable_reason != options.NotWritableReason.DRIFTED:
            raise InvalidOption(key, not_writable_reason)
        elif not_writable_reason == options.NotWritableReason.DRIFTED:
            drifted_options.add(key)

    return drifted_options


def _attempt_update(key: str, value: Any, drifted_options: Set[str], dry_run: bool) -> None:
    from sentry import options

    if key in drifted_options:
        click.echo(DRIFT_MSG % key)
        return

    if options.get(key) == value:
        if options.get_last_update_channel(key) != options.UpdateChannel.AUTOMATOR:
            if not dry_run:
                options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
            click.echo(CHANNEL_UPDATE_MSG % key)
        return

    if not dry_run:
        options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
    click.echo(UPDATE_MSG % key)


def _load_options_file(filename: str) -> Mapping[str, Any]:
    with open(filename) as stream:
        data = yaml.safe_load(stream)

    # This is to support the legacy structure of the options file that
    # contained multiple sections.
    # Those sections are not needed anymore as the list of options that
    # must be provided by the file are all the options flagged as
    # FLAG_AUTOMATOR_MODIFIABLE.
    options_to_update: Mapping[str, Any] = data.get("update", {})
    if not options_to_update:
        options_to_update = data
    return options_to_update


@click.group()
def configoptions() -> None:
    "Manages Sentry options."


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dry-run",
    is_flag=True,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def patch(filename: str, dry_run: bool) -> None:
    "Updates, gets, and deletes options that are each subsectioned in the given file."

    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    options_to_update = _load_options_file(filename)
    drifted_options = _validate_options(options_to_update)

    for key, value in options_to_update.items():
        _attempt_update(key, value, drifted_options, dry_run)


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def sync(filename: str, dry_run: bool):
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."

    from sentry import options

    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    options_to_update = _load_options_file(filename)

    drifted_options = _validate_options(options_to_update)
    all_options = options.filter(options.FLAG_AUTOMATOR_MODIFIABLE)

    for opt in all_options:
        if opt.name in options_to_update:
            _attempt_update(opt.name, options_to_update[opt.name], drifted_options, dry_run)
        else:
            if not dry_run:
                options.delete(opt.name)
            click.echo(UNSET_MSG % opt.name)
