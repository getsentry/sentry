from __future__ import annotations

import click

from sentry.backup.exports import exports
from sentry.backup.imports import imports
from sentry.runner.decorators import configuration


@click.command(name="import")
@click.argument("src", type=click.File("rb"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_(src, silent):
    """CLI command wrapping the `exec_import` functionality."""

    imports(src, (lambda *args, **kwargs: None) if silent else click.echo)


@click.command()
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent", default=2, help="Number of spaces to indent for the JSON output. (default: 2)"
)
@click.option("--exclude", default=None, help="Models to exclude from export.", metavar="MODELS")
@configuration
def export(dest, silent, indent, exclude):
    """Exports core metadata for the Sentry installation."""

    exports(dest, indent, exclude, (lambda *args, **kwargs: None) if silent else click.echo)
