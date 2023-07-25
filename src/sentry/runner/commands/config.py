import click

from sentry.runner.decorators import configuration


@click.group()
def config():
    "Manage runtime config options."


@config.command()
@click.argument("pattern", default="*", required=False)
@configuration
def list(pattern):
    "List configuration options."
    from fnmatch import fnmatch

    from sentry.options import default_manager as manager

    for key in manager.all():
        if fnmatch(key.name, pattern):
            click.echo(f"{key.name} {key.type.name.upper()}")


@config.command()
@click.option("--silent", "-q", default=False, is_flag=True, help="Suppress extraneous output.")
@click.argument("option")
@configuration
def get(option, silent):
    "Get a configuration option."
    from django.conf import settings

    from sentry.options import default_manager as manager
    from sentry.options.manager import UnknownOption

    try:
        key = manager.lookup_key(option)
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % option)
    value = manager.get(key.name)
    if silent:
        click.echo(value)
        return

    last_update_channel = manager.get_last_update_channel(option)
    click.echo(f"           type: {key.type.name.upper()}")
    click.echo(f"    from config: {settings.SENTRY_OPTIONS.get(key.name, '<not set>')}")
    click.echo(f"        current: {value}")
    click.echo(
        f" last update by: {last_update_channel.value if last_update_channel else '<not set>'}"
    )


@config.command()
@click.option(
    "--secret", default=False, is_flag=True, help="Hide prompt input when inputting secret data."
)
@click.argument("key")
@click.argument("value", required=False)
@configuration
def set(key, value, secret):
    "Set a configuration option to a new value."
    from sentry import options
    from sentry.options import UpdateChannel
    from sentry.options.manager import UnknownOption

    if value is None:
        if secret:
            value = click.prompt("(hidden) Value", hide_input=True)
        else:
            value = click.prompt("Value")

    try:
        options.set(key, value, channel=UpdateChannel.CLI)
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % key)
    except TypeError as e:
        raise click.ClickException(str(e))


@config.command()
@click.option("--no-input", default=False, is_flag=True, help="Do not show confirmation.")
@click.argument("option")
@configuration
def delete(option, no_input):
    "Delete/unset a configuration option."
    from sentry import options
    from sentry.options.manager import UnknownOption

    if not no_input:
        click.confirm('Are you sure you want to delete "%s"?' % option, default=False, abort=True)
    try:
        options.delete(option)
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % option)


@config.command()
@click.option(
    "--flags",
    "-f",
    default=0,
    help=(
        "The flags we want to filter. This is supposed to be a disjunction "
        "of all required flags. All the flags provided have to be present in "
        "the option definition."
    ),
)
@click.option(
    "--only-set",
    "-s",
    is_flag=True,
    default=False,
    help="Skip options that are not set in DB/setting fi this flag is set.",
)
@click.option(
    "--pretty-print",
    is_flag=True,
    default=False,
    help="Prints the options in (key) : (value) format.",
)
@configuration
def dump(flags: int, only_set: bool, pretty_print: bool) -> None:
    """
    Dump the values of all options except for those flagged as credential.
    For each option it provides name, value, last update channel, whether
    the option is set on the DB or disk.
    """
    from django.conf import settings

    from sentry import options

    all_options = options.all()

    for opt in all_options:
        if not flags or (flags & opt.flags == flags):
            is_set = options.isset(opt.name)
            set_on_disk = settings.SENTRY_OPTIONS.get(opt.name)
            value = options.get(opt.name)
            is_credential = opt.has_any_flag({options.FLAG_CREDENTIAL})
            last_update_channel = options.get_last_update_channel(opt.name)

            if not only_set or (only_set and is_set):
                if is_credential:
                    click.echo(
                        f"Option: {opt.name} is a credential. Skipping. Not showing this to you."
                    )

                if pretty_print:
                    click.echo(f"{opt.name} : {value}")
                else:
                    click.echo(
                        f"Option: {opt.name}. Set: {is_set}. Set in settings: "
                        f"{set_on_disk is not None}. "
                        f"Last channel: {last_update_channel.value if last_update_channel else 'None'}. "
                        f"Value: {value}"
                    )


@config.command(name="generate-secret-key")
def generate_secret_key():
    "Generate a new cryptographically secure secret key value."
    from sentry.runner.settings import generate_secret_key

    click.echo(generate_secret_key())


@config.command()
def discover():
    "Print paths to config files."
    from sentry.runner.settings import discover_configs

    _, py, yaml = discover_configs()
    click.echo(py)
    click.echo(yaml)
