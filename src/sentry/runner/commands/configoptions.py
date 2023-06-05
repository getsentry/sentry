from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Optional

import click
import yaml

from sentry.runner.decorators import configuration

if TYPE_CHECKING:
    from sentry.options import NotWritableReason


class InvalidConfigFile(Exception):
    def __init__(self, message: str, reason: "NotWritableReason") -> None:
        super().__init__(message)
        self.reason = reason

    def __str__(self):
        return f"{str(super())}. Reason: {self.reason}"


def _validate_options(content: Mapping[str, Any]) -> Mapping[str, "NotWritableReason"]:

    from sentry import options

    not_writable_reasons: MutableMapping[str, Optional[options.NotWritableReason]] = {}

    for key, value in content.items():
        not_writable_reason = options.can_update(key, value, options.UpdateChannel.AUTOMATOR)

        if not_writable_reason and not_writable_reason != options.NotWritableReason.DRIFTED:
            raise InvalidConfigFile(f"Invalid entry. Option {key}", not_writable_reason)

        not_writable_reasons[key] = not_writable_reason

    return not_writable_reasons


def _perform_update(key: str, value: Any, dry_run: bool) -> str:
    from sentry import options

    if options.get(key) == value:
        last_update_channel = options.get_last_update_channel(key)
        if last_update_channel != options.UpdateChannel.AUTOMATOR:
            if not dry_run:
                options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
        return f"Option: {key} value unchanged. Last update channel updated."

    if not dry_run:
        options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
    return f"Option: {key} updated."


@click.group()
def configoptions() -> None:
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
def patch(filename: str, dryrun: bool) -> None:
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
def sync(filename: str, dryrun: bool):
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."
    import yaml

    from sentry import options

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
    all_options = options.filter(options.FLAG_AUTOMATOR_MODIFIABLE)

    for opt in all_options:
        if opt.name in options_to_update:
            if not_writable_reasons[opt.name] is not None:
                click.echo(
                    f"Option {opt.name} cannot be updated. Reason: {not_writable_reasons[opt.name].value}"
                )
            else:
                output = _perform_update(opt.name, options_to_update[opt.name], dryrun)
                click.echo(output)
        else:
            if not dryrun:
                options.delete(opt.name)
            click.echo(f"Option {opt.name} unset.")
