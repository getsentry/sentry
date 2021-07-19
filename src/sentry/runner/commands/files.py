import click

from sentry.runner.decorators import configuration


@click.group()
def files():
    """Manage files from filestore."""
    pass


@files.command()
@click.argument("id", type=click.INT, metavar="FILE_ID")
@configuration
def get(id):
    """Fetch a file's contents by id."""
    from sentry.models import File

    try:
        file = File.objects.get(id=id)
    except File.DoesNotExist:
        raise click.ClickException("File %d does not exist." % id)

    stdout = click.get_binary_stream("stdout")

    with file.getfile() as fp:
        for chunk in fp.chunks():
            stdout.write(chunk)


@files.command()
@click.argument("id", type=click.INT, metavar="FILE_ID")
@click.option("--format", default="json", type=click.Choice(("json", "yaml")))
@configuration
def info(id, format):
    """Show a file's metadata by id."""
    from sentry.models import File

    try:
        file = File.objects.get(id=id)
    except File.DoesNotExist:
        raise click.ClickException("File %d does not exist." % id)

    obj = {
        "id": file.id,
        "name": file.name,
        "headers": file.headers,
        "size": file.size,
        "sha1": file.checksum,
        "dateCreated": file.timestamp,
    }

    stdout = click.get_text_stream("stdout")

    if format == "yaml":
        from sentry.utils import yaml

        yaml.safe_dump(obj, stdout)
    elif format == "json":
        from sentry.utils import json

        json.dump(obj, stdout)
        stdout.write("\n")
