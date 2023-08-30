from __future__ import annotations

import click

from sentry.backup.exports import OldExportConfig, _export
from sentry.backup.imports import OldImportConfig, _import
from sentry.backup.scopes import ExportScope, ImportScope
from sentry.runner.decorators import configuration


@click.command(name="import")
@click.argument("src", type=click.File("rb"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_(src, silent):
    """Imports core data for a Sentry installation."""

    _import(
        src,
        ImportScope.Global,
        OldImportConfig(
            use_update_instead_of_create=True,
            use_natural_foreign_keys=True,
        ),
        (lambda *args, **kwargs: None) if silent else click.echo,
    )


@click.command()
@click.argument("dest", default="-", type=click.File("w"))
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@click.option(
    "--indent", default=2, help="Number of spaces to indent for the JSON output. (default: 2)"
)
@click.option("--exclude", default=None, help="Models to exclude from export.", metavar="MODELS")
@configuration
def export(dest, silent, indent, exclude):
    """Exports core data for the Sentry installation."""

    if exclude is None:
        exclude = []
    else:
        exclude = exclude.lower().split(",")

    _export(
        dest,
        ExportScope.Global,
        OldExportConfig(
            include_non_sentry_models=True,
            excluded_models=set(exclude),
            use_natural_foreign_keys=True,
        ),
        indent,
        (lambda *args, **kwargs: None) if silent else click.echo,
    )
