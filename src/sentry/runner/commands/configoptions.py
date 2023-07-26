import sys
from typing import Any, Dict, List, Optional, Set

import click
import requests
from yaml import safe_dump, safe_load

from sentry.runner.decorators import configuration, log_options
from sentry.utils import json

# These messages are produced more than once and referenced in tests.
# This is the reason they are constants.
DRIFT_MSG = "[DRIFT] Option %s drifted and cannot be updated."
DB_VALUE = "Value of option %s on DB:"
CHANNEL_UPDATE_MSG = "[CHANNEL UPDATE] Option %s value unchanged. Last update channel updated."
UPDATE_MSG = "[UPDATE] Option %s updated. Old value: \n%s\nNew value: \n%s"
SET_MSG = "[SET] Option %s set to value: \n%s"
UNSET_MSG = "[UNSET] Option %s unset."


def _attempt_update(
    key: str,
    value: Any,
    drifted_options: Set[str],
    json_data: Dict[str, List[str]],
    dry_run: bool,
    hide_drift: bool,
) -> None:
    """
    Updates the option if it is not drifted and if we are not in dry
    run mode.
    """
    import logging

    from sentry import options

    logger = logging.getLogger("sentry.options_automator")

    opt = options.lookup_key(key)

    db_value = options.get(key)
    db_value_to_print = "[REDACTED]" if opt.has_any_flag({options.FLAG_CREDENTIAL}) else db_value
    if key in drifted_options:
        click.echo(DRIFT_MSG % key)
        logger.error("Option %s drifted and cannot be updated.", key)
        json_data["drifted_options"].append(DRIFT_MSG % key)
        if not hide_drift:
            click.echo(DB_VALUE % key)
            # This is yaml instead of the python representation as the
            # expected flow, in this case, is to use the output of this
            # line to copy paste it in the config map.
            click.echo(safe_dump(db_value_to_print))
        return

    last_update_channel = options.get_last_update_channel(key)
    if db_value == value:
        # This script is making changes with UpdateChannel.AUTOMATOR
        # channel. Thus, if the laast update channel was already
        # UpdateChannel.AUTOMATOR, and the value we are trying to set
        # is the same as the value already stored we do nothing.
        if last_update_channel is None:
            # Here we are trying to set an option with a value that
            # is equal to its default. There are valid cases for this
            # behavior: I plan to change the default value of an option
            # without changing the production behavior. So I would
            # first set the option to the current default value in
            # the DB and then change the default value.
            if not dry_run:
                options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
            click.echo(SET_MSG % (key, value))
            json_data["updated_options"].append(SET_MSG % (key, value))

        elif last_update_channel != options.UpdateChannel.AUTOMATOR:
            if not dry_run:
                options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
            click.echo(CHANNEL_UPDATE_MSG % key)
            json_data["updated_options"].append(CHANNEL_UPDATE_MSG % key)
        return

    if not dry_run:
        options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
    if last_update_channel is not None:
        click.echo(UPDATE_MSG % (key, db_value, value))
        json_data["updated_options"].append(UPDATE_MSG % (key, db_value, value))
    else:
        click.echo(SET_MSG % (key, value))
        json_data["updated_options"].append(SET_MSG % (key, value))


@click.group()
@click.option(
    "--dry-run",
    is_flag=True,
    help="Prints the updates without applying them.",
)
@click.option("-f", "--file", help="File name to load. If not provided assume stdin.")
@click.option(
    "--hide-drift",
    is_flag=True,
    help="Hide the actual value of the option on DB when detecting drift.",
)
@log_options()
@click.pass_context
@configuration
def configoptions(ctx, dry_run: bool, file: Optional[str], hide_drift: bool) -> None:
    """
    Makes changes to options in bulk starting from a yaml file.
    Contrarily to the `config` command, this is meant to perform
    bulk updates only.

    The input must be in yaml format.
    A dry run option is provided to test the update before performing it.

    A single invalid option would make the command fail and return -1,
    no update is performed in this way.
    Invalid options are those the cannot be modified by the Option
    Automator in any circumstance. Examples: read only options,
    credentials, etc.

    Valid options can be drifted: the option has been updated in the
    store by another channel. These options are skipped in order not
    to overwrite the change.

    If an option updated by another channel is found but the value in
    the store is the same as the one in the file, the update channel
    is updated to Automator.
    This allows us to fix drift by fixing the file to match the drifted
    value. Once the file is fixed the and re-applied, the
    `last_updated_by` field will be set to Automator, and this script
    will be able to apply further changes.

    All other options are considered valid and updated to the value
    present in the file.

    This script is the Options Automator. The UpdateChannel it uses
    to apply changes is UpdateChannel.AUTOMATOR.
    """

    from sentry import options

    ctx.obj["dry_run"] = dry_run

    with open(file) if file is not None else sys.stdin as stream:
        options_to_update = safe_load(stream)

    options_to_update = options_to_update["options"]
    ctx.obj["options_to_update"] = options_to_update

    drifted_options = set()

    json_data = {"dry-run": dry_run, "updated_options": [], "drifted_options": []}

    for key, value in options_to_update.items():
        not_writable_reason = options.can_update(key, value, options.UpdateChannel.AUTOMATOR)

        if not_writable_reason and not_writable_reason != options.NotWritableReason.DRIFTED:
            msg = f"Invalid option. {key} cannot be updated. Reason {not_writable_reason.value}"
            click.echo(msg)

            exit(-1)
        elif not_writable_reason == options.NotWritableReason.DRIFTED:
            drifted_options.add(key)

    ctx.obj["drifted_options"] = drifted_options
    ctx.obj["hide_drift"] = hide_drift
    ctx.obj["json_data"] = json_data


@configoptions.command()
@click.pass_context
@configuration
def patch(ctx) -> None:
    """
    Applies to the DB the option values found in the config file.
    Only the options present in the file are updated. No deletions
    are performed.
    """
    dry_run = bool(ctx.obj["dry_run"])
    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    for key, value in ctx.obj["options_to_update"].items():
        _attempt_update(
            key,
            value,
            ctx.obj["drifted_options"],
            ctx.obj["json_data"],
            dry_run,
            bool(ctx.obj["hide_drift"]),
        )

    send_to_webhook(ctx.obj["json_data"])


@configoptions.command()
@click.pass_context
@configuration
def sync(ctx):
    """
    Synchronizes the content of the file with the DB. The source of
    truth is the config file, not the DB. If an option is missing in
    the file, it is deleted from the DB.
    """

    from sentry import options

    dry_run = bool(ctx.obj["dry_run"])
    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    all_options = options.filter(options.FLAG_AUTOMATOR_MODIFIABLE)

    options_to_update = ctx.obj["options_to_update"]
    for opt in all_options:
        if opt.name in options_to_update:
            _attempt_update(
                opt.name,
                options_to_update[opt.name],
                ctx.obj["drifted_options"],
                ctx.obj["json_data"],
                dry_run,
                bool(ctx.obj["hide_drift"]),
            )
        else:
            if options.isset(opt.name):
                if options.get_last_update_channel(opt.name) == options.UpdateChannel.AUTOMATOR:
                    if not dry_run:
                        options.delete(opt.name)
                    click.echo(UNSET_MSG % opt.name)
                    ctx.obj["updated_options"].append(UNSET_MSG % opt.name)
                else:
                    click.echo(DRIFT_MSG % opt.name)
                    ctx.obj["drifted_options"].append(DRIFT_MSG % opt.name)

    send_to_webhook(ctx.obj["json_data"])


def send_to_webhook(json_data):
    headers = {"Content-Type": "application/json"}
    try:
        # todo: change webhook url (pass in as k8s secret? eng pipes is public)
        #       send http post request to engpipes webhook
        #       figure out how to add env var k8s secrets
        response = requests.post("webhook_url", data=json.dumps(json_data), headers=headers)
        response.raise_for_status()  # Raise an exception for non-2xx responses
        click.echo("Webhook request sent successfully!")
    except requests.exceptions.RequestException as e:
        click.echo(f"{e}")
