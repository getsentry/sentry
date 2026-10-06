from __future__ import annotations

import click

from sentry.runner.decorators import configuration


@click.command("migrate_debugfiles_to_objectstore")
@configuration
def migrate_debugfiles_to_objectstore() -> None:
    """Migrate legacy File-backed debug files to Objectstore.

    Offline, single-process walk used by self-hosted installs (e.g. from
    ``install.sh``). SaaS uses the sharded taskworker migration instead.
    """
    from sentry.debug_files.objectstore_migration.utils import migrate_debug_file
    from sentry.models.debugfile import ProjectDebugFile

    click.echo("Migrating debug files from Filestore to Objectstore...")

    total = 0
    queryset = (
        ProjectDebugFile.objects.filter(file_id__isnull=False)
        .select_related("file")
        .order_by("-id")
    )
    for debug_file in queryset.iterator():
        click.echo(f"Migrating debug file {debug_file.id}...")
        migrate_debug_file(debug_file)
        total += 1

    click.echo(f"Migrated {total} debug file(s).")
