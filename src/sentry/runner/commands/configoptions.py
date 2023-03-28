import click
import yaml
from sentry import options


@click.group()
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@click.option("--key", "-k", required=True, help="The key of the option to fetch.")
def fetch(key):
    click.echo(get(key))


@configoptions.command()
def fetchAll():
    for opt in options.all():
        click.echo(f"{opt.name} ({opt.type}) = {options.get(opt.name)}")


@configoptions.command()
@click.argument("filename", required=True)
def patch(filename):
    with open(filename, "r") as stream:

        # todo: add more file validation?
        file = yaml.safe_load(stream)
        data = file["data"]
        keysToFetch = data["fetch"]
        keysToUpdate = data["update"]
        keysToDelete = data["delete"]

        for key in keysToFetch:
            click.echo(get(key))

        for key, val in keysToUpdate:
            click.echo(set(key, val))

        for key in keysToDelete:
            click.echo(delete(key))


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
        return f"Registered key: {opt.name} ({opt.type}) = {options.get(opt.name)}"


def delete(key):
    from sentry.options.manager import UnknownOption

    try:
        options.lookup_key(key)
        options.delete(key)
        return f"Deleted key: {key}"
    except UnknownOption:
        return "unknown option: %s" % key
