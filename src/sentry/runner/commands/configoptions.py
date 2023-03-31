import re

import click

from sentry.runner.decorators import configuration

tracked = [
    re.compile("sentry:test_key.+"),
]

verbose = False


def create_key_value_generator(data: str, newline_separator: str, kv_separator: str):
    return (line.split(kv_separator) for line in data.split(newline_separator) if line)


@click.group()
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@click.option("--key", "-k", required=True, help="The key of the option to fetch.")
@configuration
def fetch(key: str):
    "Fetches the option for the given key."
    click.echo(_get(key))


@configoptions.command()
@configuration
def list():
    "Fetches all options."
    from sentry import options

    for opt in options.all():
        # click.echo(f"{opt.name} ({opt.type}) = {options.get(opt.name)}")
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
        keysToFetch = create_key_value_generator(keysToFetch, "\n", ": ")
        for key in keysToFetch:
            _get(key, dryrun)

        keysToUpdate = data.get("update", {})
        keysToUpdate = create_key_value_generator(keysToUpdate, "\n", ": ")
        for line in keysToUpdate:
            key = line[0]
            val = ""
            if len(line) > 1:
                val = line[1]
            success = set(key, val, dryrun)
            if success:
                click.echo(f"Successfully updated: {key} = {val} (dry run:{dryrun})")
            else:
                click.echo(f"Failed to update: {key} = {val} (dry run:{dryrun})")

        keysToDelete = data.get("delete", {})
        keysToDelete = create_key_value_generator(keysToDelete, "\n", ": ")
        for key in keysToDelete:
            click.echo(delete(key, dryrun))
            click.echo(f"Successfully deleted: {key} (dry run:{dryrun})")


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
def strict(filename: str, dryrun: bool) -> bool:
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."
    import yaml

    from sentry import options

    if dryrun:
        click.echo("Dryrun flag on. ")

    with open(filename) as stream:
        configmap_data = yaml.safe_load(stream)
        data = configmap_data.get("data", {}).get("options-strict.yaml", "")

        kv_generator = create_key_value_generator(data, "\n", ": ")
        db_keys = (opt.name for opt in options.all())
        for key in db_keys:

            if not can_change(key):
                continue

            if key not in kv_generator:
                success = _delete(key, dryrun)
                if success:
                    click.echo(f"Successfully deleted: {key} (dry run:{dryrun})")
                else:
                    click.echo(f"Failed to deleted: {key} (dry run:{dryrun})")

        kv_generator = create_key_value_generator(data, "\n", ": ")
        for line in kv_generator:
            click.echo(f"line: {line} {type(line)}")
            key = line[0]
            val = ""
            click.echo(f"key: {key} {type(key)}")
            if len(line) > 1:
                val = line[1]
            click.echo(f"val: {val} {type(val)}")
            click.echo(f"dryrun: {dryrun} {type(dryrun)}")
            success = _set(key, val, dryrun)
            if success:
                click.echo(f"Successfully updated: {key} = {val} (dry run:{dryrun})")
            else:
                click.echo(f"Failed to update: {key} = {val} (dry run:{dryrun})")


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
    return _get(key, dryrun)


def _get(key: str, dryrun: bool = False) -> str:
    from sentry import options
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        click.echo(f"Fetched Key: {opt.name} ({opt.type}) = {options.get(opt.name)}")
        return opt
    except UnknownOption:
        click.echo("unknown option: %s" % key)
        return ""


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
def set(key: str, val: str, dryrun: bool = False) -> bool:
    return _set(key, val, dryrun)


def _set(key: str, val: str, dryrun: bool = False) -> bool:
    from sentry import options
    from sentry.options.manager import UnknownOption

    success = False
    if not can_change(key):
        return success

    try:
        opt = options.lookup_key(key)

    except UnknownOption:
        click.echo(f"Unknown Option in set: {key}")
        if not dryrun:
            try:
                options.register(key)
                options.set(key, val)
                success = True
                click.echo(f"Registered a new key: {key} = {val}")
            except Exception:
                click.echo(f"Failed to register option: {key} = {val}")

    else:
        if not dryrun:
            try:
                options.set(key, val)
                success = True
                click.echo(f"Updated key: {opt.name} ({opt.type}) = {val}")
            except Exception:
                click.echo(f"Failed to update key: {opt.name} ({opt.type}) = {val}")

    return success


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

    success = False
    if not can_change(key):
        return True

    try:
        options.lookup_key(key)
        if not dryrun:
            options.delete(key)
        click.echo(f"Deleted key: {key}")
        success = True
    except UnknownOption:
        click.echo(f"Unknown Option, can't delete: {key}")
    return success


def can_change(key: str) -> bool:
    from sentry.options import manager

    opt = get(key)
    # if opt.flags
    changable = not ((opt.flags & manager.FLAG_NOSTORE) and (opt.flags & manager.FLAG_IMMUTABLE))
    # TODO: Figure out how to look this up
    for i in tracked:
        is_match = i.match(key)
        if is_match:
            click.echo(f"Key({key}) matches {is_match} a tracked Regex({i})")
            changable = True
            return changable

    if changable:
        # click.echo(f"Key({key}) is mutable!")
        pass
    else:
        # click.echo(f"Key({key}) is not mutable!")
        pass
    return changable
