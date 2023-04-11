import re

import click

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
        # click.echo(f"{opt.name} ({opt.type}) = {options.get(opt.name)}")
        # click.echo(type(opt))
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
    import yaml

    if dryrun:
        click.echo("Dryrun flag on. ")
    with open(filename) as stream:
        configmap_data = yaml.safe_load(stream)
        data = configmap_data.get("data", {}).get("options-patch.yaml", "")

        keysToFetch = data.get("fetch", {})
        keysToUpdate = data.get("update", {})
        keysToDelete = data.get("delete", {})

        for key in keysToFetch:
            _get(key, dryrun)

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

    from sentry import options

    if dryrun:
        click.echo("Dryrun flag on. ")

    with open(filename) as stream:
        configmap_data = yaml.safe_load(stream)
        data = configmap_data.get("data", {}).get("options-strict.yaml", "")

        db_keys = (opt.name for opt in options.all())
        for key in db_keys:
            if not can_change(key):
                click.echo(f"cannot change key {key}")
                continue
            if key not in data.keys():
                _delete(key, dryrun)

        for key, val in data.items():
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


def _get(key: str, dryrun: bool = False) -> str:
    from sentry import options
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        click.echo(f"Fetched Key: {opt.name} ({opt.type}) = {options.get(opt.name)}")
        return opt
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % key)
    except TypeError as e:
        raise click.ClickException(str(e))


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
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        if not dryrun:
            options.set(key, val)
            click.echo(f"Updated key: {opt.name} ({opt.type}) = {val}")
            return opt
        else:
            click.echo(f"Updated key: {opt.name} ({opt.type}) = {val}")
            return opt
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % key)
    except TypeError as e:
        raise click.ClickException(str(e))


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
    return _delete(key, dryrun)


def _delete(key: str, dryrun: bool = False) -> bool:
    from sentry import options
    from sentry.options.manager import UnknownOption

    try:
        options.lookup_key(key)

        if not can_change(key):
            raise click.ClickException(f"Option {key} cannot be changed.")

        if not dryrun:
            options.delete(key)
        click.echo(f"Deleted key: {key}")
        return options.get(key)
    except UnknownOption:
        raise click.ClickException("unknown option: %s" % key)
    except TypeError as e:
        raise click.ClickException(str(e))


tracked = [
    re.compile("sentry:test_key.+"),
]

verbose = False


def create_key_value_generator(data: str, newline_separator: str, kv_separator: str):
    return (line.split(kv_separator) for line in data.split(newline_separator) if line)


def can_change(key: str) -> bool:
    from sentry import options
    from sentry.options import manager

    opt = options.lookup_key(key)
    return not ((opt.flags & manager.FLAG_NOSTORE) or (opt.flags & manager.FLAG_IMMUTABLE))

    # changable = not ((opt.flags & manager.FLAG_NOSTORE) and (opt.flags & manager.FLAG_IMMUTABLE))
    # changable = False
    # TODO: Figure out how to look this up
    # for i in tracked:
    #     is_match = i.match(key)
    #     if is_match:
    #         click.echo(f"Key({key}) matches {is_match} a tracked Regex({i})")
    #         changable = True
    #         return changable

    # if changable:
    #     # click.echo(f"Key({key}) is mutable!")
    #     pass
    # else:
    #     # click.echo(f"Key({key}) is not mutable!")
    #     pass
    # return changable
