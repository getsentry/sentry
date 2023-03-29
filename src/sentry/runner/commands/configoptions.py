import click
import yaml

from sentry import options
from sentry.runner.decorators import configuration

# todo: implement dryrun


@click.group()
@configuration
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@click.option("--key", "-k", required=True, help="The key of the option to fetch.")
@configuration
def fetch(key):
    "Fetches the option for the given key."
    click.echo(get(key))


@configoptions.command()
@configuration
def fetchAll():
    "Fetches all options."
    for opt in options.all():
        click.echo(f"{opt.name} ({opt.type}) = {options.get(opt.name)}")


@configoptions.command()
@click.argument("filename", required=True)
# @click.option(
#     "--dryrun", default=False , required=False, help="Output exactly what changes would be made and in which order."
# )
@configuration
def patch(filename):
    "Updates, gets, and deletes options that are each subsectioned in the given file."
    with open(filename) as stream:
        # todo: add more file validation?
        data = yaml.safe_load(stream)
        keysToFetch = data["fetch"]
        keysToUpdate = data["update"]
        keysToDelete = data["delete"]

        for key in keysToFetch:
            click.echo(get(key))

        for key, val in keysToUpdate:
            click.echo(set(key, val))

        for key in keysToDelete:
            click.echo(delete(key))


@configoptions.command()
@click.argument("filename", required=True)
# @click.option(
#     "--dryrun", default=False , required=False, help="Output exactly what changes would be made and in which order."
# )
@configuration
def strict(filename):
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."
    with open(filename) as stream:
        data = yaml.safe_load(stream)
        file_keys = (key[0] for key in data)

        db_keys = (opt.name for opt in options.all())

        # update the database to remove all keys NOT in the given file.
        for key in db_keys:
            if key not in file_keys:
                delete(key)

        for key, val in data:
            set(key, val)


def get(key):
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        return f"{opt.name} ({opt.type}) = {options.get(opt.name)}"
    except UnknownOption:
        return "unknown option: %s" % key


def set(key, val):
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        options.set(key, val)
        return f"Updated key: {opt.name} ({opt.type}) = {options.get(opt.name)}"

    except UnknownOption:
        options.register(key)
        options.set(key, val)
        return f"Registered a new key: {key} = {val}"


def delete(key):
    from sentry.options.manager import UnknownOption

    try:
        options.lookup_key(key)
        options.delete(key)
        return f"Deleted key: {key}"
    except UnknownOption:
        return "unknown option: %s" % key
