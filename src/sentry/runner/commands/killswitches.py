import click

from sentry.runner.decorators import configuration


@click.group()
def killswitches():
    "Manage killswitches for ingestion pipeline."


def _safe_modify(killswitch_name, modify_func):
    from sentry import killswitches, options

    option_value = options.get(killswitch_name)
    new_option_value = modify_func(option_value)

    if option_value == new_option_value:
        click.echo("No changes!")
        raise click.Abort()

    click.echo("Before:")
    click.echo(killswitches.print_conditions(option_value))
    click.echo("After:")
    click.echo(killswitches.print_conditions(new_option_value))

    click.confirm("Should the changes be applied?", default=False, show_default=True, abort=True)
    options.set(killswitch_name, new_option_value)


@killswitches.command()
@click.option("--killswitch", required=True)
@click.option("--field", required=True)
@click.option("--value", required=True)
@configuration
def add_condition(killswitch, field, value):
    """
    Add another condition to the given killswitch.

    For example, starting from a blank slate.

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field project_id --value 42

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field project_id --value 43

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field event_type --value transactions


    ...will drop transaction events from projects 42 and 43 from within the ingest consumer.

    For now, always check in-code which fields are actually available within
    the killswitch! For example you can pass `--field username` and it will be
    written to the sentry option, but then silently ignored in ingest consumer.

    The command will print before/after state and ask for explicit confirmation.
    """

    from sentry import killswitches

    _safe_modify(
        killswitch, lambda option_value: killswitches.add_condition(option_value, field, value)
    )


@killswitches.command()
@click.option("--killswitch", required=True)
@click.option("--field", required=True)
@click.option("--value", required=True)
@configuration
def remove_condition(killswitch, field, value):
    """
    Remove a specific condition from the given killswitch.

    For example:

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field project_id --value 42

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field project_id --value 43

        sentry killswitches add-condition --killswitch store.load-shed-pipeline-projects --field event_type --value transactions

        sentry killswitches remove-condition --killswitch store.load-shed-pipeline-projects --field event_type --value transactions


    ...will first drop transaction events from projects 42 and 43 from within
    the ingest consumer, then the restriction on transaction events is lifted
    and all events from those projects are dropped.

    The command will print before/after state and ask for explicit confirmation.
    """

    from sentry import killswitches

    _safe_modify(
        killswitch, lambda option_value: killswitches.remove_condition(option_value, field, value)
    )


@killswitches.command()
@click.option("--killswitch", required=True)
@click.option("--field", required=True)
@configuration
def clear_killswitch(killswitch):
    """
    Clear all conditions of a particular killswitch, disabling it.
    """

    _safe_modify(killswitch, lambda _: {})


@killswitches.command()
@configuration
def list():
    """
    List all killswitches and whether they are enabled (and how).
    """

    from sentry import killswitches, options

    for killswitch in killswitches.ALL_KILLSWITCH_OPTIONS:
        conditions = killswitches.print_conditions(options.get(killswitch))
        click.echo(f"{killswitch}: {conditions}")
