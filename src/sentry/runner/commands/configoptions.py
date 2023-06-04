from typing import Any, Mapping, MutableMapping, Optional

import click
import yaml

from sentry.runner.decorators import configuration


class InvalidConfigFile(Exception):
    def __init__(self, message: str, reason) -> None:
        super.__init__(message)
        self.reason = reason


def _validate_options(content: Mapping[str, Any]) -> Mapping[str, Any]:

    from sentry import options

    not_writable_reasons: MutableMapping[str, Optional[options.NotWritableReason]] = {}

    for key, value in content:
        not_writable_reason = options.can_update(key, value, options.UpdateChannel.AUTOMATOR)

        if not_writable_reason and not_writable_reason != options.NotWritableReason.DRIFTED:
            raise InvalidConfigFile(f"Invalid entry. Option {key}", not_writable_reason)

        not_writable_reasons[key] = not_writable_reason

    return not_writable_reasons


def _perform_update(key: str, value: Any, dry_run: bool) -> str:
    from sentry import options

    if options.get(key) == value:
        if options.isset(key):
            last_update_channel = options.get_last_update_channel(key)
            if last_update_channel != options.UpdateChannel.AUTOMATOR:
                if not dry_run:
                    options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
            return f"Option: {key} value unchanged. Last update channel updated."
        else:
            return f"Option: {key} ignored. Not set on DB and provided values equals default value."

    if not dry_run:
        options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
    return "Option: {key} updated."


@click.group()
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def patch(filename: str, dryrun: bool):
    "Updates, gets, and deletes options that are each subsectioned in the given file."

    if dryrun:
        click.echo("Dryrun flag on.")
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

    not_writable_reasons = _validate_options(options_to_update)

    for key, value in options_to_update.items():
        if not_writable_reasons[key] is not None:
            click.echo(f"Option {key} cannot be updated. Reason: {not_writable_reasons[key].value}")
        else:
            output = _perform_update(key, value, dryrun)
            click.echo(output)


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def strict(filename: str, dryrun: bool):
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."
    import yaml

    from sentry import options

    if dryrun:
        click.echo("Dryrun flag on. ")

    with open(filename) as stream:
        data = yaml.safe_load(stream).get("data", {})

        for opt in options.filter(options.FLAG_AUTOMATOR_MODIFIABLE):
            if opt.name not in data.keys():
                _delete(opt.name)

        for key, val in data.items():
            if key in options.filter(options.FLAG_AUTOMATOR_MODIFIABLE):
                _set(key, val, dryrun)


def _delete(key: str, dryrun: bool = False) -> bool:
    from sentry import options

    options.lookup_key(key)

    # if not options.can_update(key):
    #    raise click.ClickException(f"Option {key} cannot be changed.")

    if not dryrun:
        options.delete(key)
    click.echo(f"Deleted key: {key}")
    return options.get(key)
