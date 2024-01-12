import sys
from typing import Any, Optional, Set

import click
from yaml import safe_load

from sentry.runner.commands.presenters.presenterdelegator import PresenterDelegator
from sentry.runner.decorators import configuration, log_options


def _attempt_update(
    presenter_delegator: PresenterDelegator,
    key: str,
    value: Any,
    drifted_options: Set[str],
    dry_run: bool,
    hide_drift: bool,
) -> None:
    """
    Updates the option if it is not drifted and if we are not in dry
    run mode.
    """

    from sentry import options

    opt = options.lookup_key(key)

    db_value = options.get(key)
    db_value_to_print = "[REDACTED]" if opt.has_any_flag({options.FLAG_CREDENTIAL}) else db_value
    if key in drifted_options:
        if hide_drift:
            presenter_delegator.drift(key, "")
        else:
            presenter_delegator.drift(key, db_value_to_print)
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
            presenter_delegator.set(key, value)

        elif last_update_channel != options.UpdateChannel.AUTOMATOR:
            if not dry_run:
                options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
            presenter_delegator.channel_update(key)
        return

    if not dry_run:
        options.set(key, value, coerce=False, channel=options.UpdateChannel.AUTOMATOR)
    if last_update_channel is not None:
        presenter_delegator.update(key, db_value, value)
    else:
        presenter_delegator.set(key, value)


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
    invalid_options = set()
    presenter_delegator = PresenterDelegator("options-automator")
    ctx.obj["presenter_delegator"] = presenter_delegator

    for key, value in options_to_update.items():
        try:
            not_writable_reason = options.can_update(key, value, options.UpdateChannel.AUTOMATOR)

            if not_writable_reason and not_writable_reason != options.NotWritableReason.DRIFTED:
                presenter_delegator.not_writable(key, not_writable_reason.value)
                invalid_options.add(key)
            elif not_writable_reason == options.NotWritableReason.DRIFTED:
                drifted_options.add(key)

            opt = options.lookup_key(key)
            if not opt.type.test(value):
                invalid_options.add(key)
                presenter_delegator.invalid_type(key, type(value), opt.type)
        except options.UnknownOption:
            invalid_options.add(key)
            presenter_delegator.unregistered(key)

    ctx.obj["invalid_options"] = invalid_options
    ctx.obj["drifted_options"] = drifted_options
    ctx.obj["hide_drift"] = hide_drift


@configoptions.command()
@click.pass_context
@configuration
def patch(ctx) -> None:
    """
    Applies to the DB the option values found in the config file.
    Only the options present in the file are updated. No deletions
    are performed.
    """
    from sentry.utils import metrics

    dry_run = bool(ctx.obj["dry_run"])
    presenter_delegator = ctx.obj["presenter_delegator"]
    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    invalid_options = ctx.obj["invalid_options"]
    for key, value in ctx.obj["options_to_update"].items():
        if key not in invalid_options:
            try:
                _attempt_update(
                    presenter_delegator,
                    key,
                    value,
                    ctx.obj["drifted_options"],
                    dry_run,
                    bool(ctx.obj["hide_drift"]),
                )
            except Exception:
                metrics.incr(
                    "options_automator.run",
                    amount=2,
                    tags={"status": "update_failed"},
                    sample_rate=1.0,
                )
                presenter_delegator.flush()
                raise

    presenter_delegator.flush()

    if invalid_options:
        status = "update_failed"
        amount = 2
        ret_val = 2
    elif ctx.obj["drifted_options"]:
        status = "drift"
        amount = 2
        ret_val = 2
    else:
        status = "success"
        amount = 1
        ret_val = 0

    metrics.incr(
        "options_automator.run",
        amount=amount,
        tags={"status": status},
        sample_rate=1.0,
    )
    exit(ret_val)


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
    from sentry.utils import metrics

    dry_run = bool(ctx.obj["dry_run"])
    if dry_run:
        click.echo("!!! Dry-run flag on. No update will be performed.")

    all_options = options.filter(options.FLAG_AUTOMATOR_MODIFIABLE)

    options_to_update = ctx.obj["options_to_update"]
    invalid_options = ctx.obj["invalid_options"]
    drift_found = bool(ctx.obj["drifted_options"])
    presenter_delegator = ctx.obj["presenter_delegator"]
    for opt in all_options:
        if opt.name not in invalid_options:
            if opt.name in options_to_update:
                try:
                    _attempt_update(
                        presenter_delegator,
                        opt.name,
                        options_to_update[opt.name],
                        ctx.obj["drifted_options"],
                        dry_run,
                        bool(ctx.obj["hide_drift"]),
                    )
                except Exception:
                    metrics.incr(
                        "options_automator.run",
                        amount=2,
                        tags={"status": "update_failed"},
                        sample_rate=1.0,
                    )
                    presenter_delegator.flush()
                    raise
            else:
                if options.isset(opt.name):
                    if options.get_last_update_channel(opt.name) == options.UpdateChannel.AUTOMATOR:
                        if not dry_run:
                            try:
                                options.delete(opt.name)
                            except Exception:
                                metrics.incr(
                                    "options_automator.run",
                                    amount=2,
                                    tags={"status": "update_failed"},
                                    sample_rate=1.0,
                                )
                                presenter_delegator.flush()
                                raise

                        presenter_delegator.unset(opt.name)
                    else:
                        presenter_delegator.drift(opt.name, "")
                        drift_found = True

    if invalid_options:
        status = "update_failed"
        amount = 2
        ret_val = 2
    elif drift_found:
        status = "drift"
        amount = 2
        ret_val = 2
    else:
        status = "success"
        amount = 1
        ret_val = 0

    presenter_delegator.flush()

    metrics.incr(
        "options_automator.run",
        amount=amount,
        tags={"status": status},
        sample_rate=1.0,
    )

    exit(ret_val)
