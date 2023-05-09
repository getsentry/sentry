import click
import yaml

from sentry.runner.decorators import configuration


@click.group()
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@configuration
def list():
    "Fetches all options."
    from sentry import options

    for opt in options.all():
        if can_change(opt.name):
            click.echo(f"{opt.name}: {options.get(opt.name)}")


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
def patch(filename: str, dryrun: bool):
    "Updates, gets, and deletes options that are each subsectioned in the given file."

    if dryrun:
        click.echo("Dryrun flag on. ")
    with open(filename) as stream:
        data = yaml.safe_load(stream)

        keysToFetch = data.get("fetch", {})
        keysToUpdate = data.get("update", {})
        keysToDelete = data.get("delete", {})

        for key in keysToFetch:
            _get(key, dryrun)

        if keysToUpdate is not None:
            for key, val in keysToUpdate.items():
                _set(key, val, dryrun)

        for key in keysToDelete:
            _delete(key, dryrun)


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

    if dryrun:
        click.echo("Dryrun flag on. ")

    with open(filename) as stream:
        data = yaml.safe_load(stream).get("data", {})

        for key in TRACKED:
            if key not in data.keys():
                _delete(key)

        for key, val in data.items():
            if key in TRACKED:
                _set(key, val, dryrun)


@configoptions.command()
@click.argument("key", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def get(key: str, dryrun: bool = False) -> str:
    "Get a configuration option."
    return _get(key, dryrun)


def _get(
    key: str,
    dryrun: bool = False,
) -> str:
    from sentry import options

    opt = options.lookup_key(key)
    click.echo(f"Fetched Key: {opt.name} ({opt.type}) = {options.get(opt.name)}")
    return opt


@configoptions.command()
@click.argument("key", required=True)
@click.argument("val", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def set(key: str, val: object, dryrun: bool = False) -> bool:
    "Sets a configuration option to a new value."
    return _set(key, val, dryrun)


def _set(key: str, val: object, dryrun: bool = False) -> bool:
    from sentry import options

    opt = options.lookup_key(key)
    if not dryrun:
        options.set(key, val)
        click.echo(f"Updated key: {opt.name} ({opt.type}) = {val}")
        return opt
    else:
        click.echo(f"Updated key: {opt.name} ({opt.type}) = {val}")
        return opt


@configoptions.command()
@click.argument("key", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def delete(key: str, dryrun: bool = False) -> bool:
    "Deletes the given key. This resets the keys value to the default."
    return _delete(key, dryrun)


def _delete(key: str, dryrun: bool = False) -> bool:
    from sentry import options

    options.lookup_key(key)

    if not can_change(key):
        raise click.ClickException(f"Option {key} cannot be changed.")

    if not dryrun:
        options.delete(key)
    click.echo(f"Deleted key: {key}")
    return options.get(key)


TRACKED = {
    "system.admin-email",
    "system.support-email",
    "system.security-email",
    "system.rate-limit",
    "github-login.base-domain",
    "github-login.api-domain",
    "github-login.extended-permissions",
    "symbolserver.options",
    "nodedata.cache-sample-rate",
}


def can_change(key: str) -> bool:
    from sentry import options
    from sentry.options import manager

    opt = options.lookup_key(key)
    return (key in TRACKED) and not (
        (opt.flags & manager.FLAG_NOSTORE) or (opt.flags & manager.FLAG_IMMUTABLE)
    )
