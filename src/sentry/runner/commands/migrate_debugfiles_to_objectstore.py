from __future__ import annotations

import click

from sentry.runner.decorators import configuration


@click.command("migrate_debugfiles_to_objectstore")
@click.option("--shard-count", type=click.IntRange(min=1))
@click.option("--shard-index", type=click.IntRange(min=0), envvar="JOB_COMPLETION_INDEX")
@click.option("--max-runtime-seconds", type=click.IntRange(min=1))
@configuration
def migrate_debugfiles_to_objectstore(
    shard_count: int | None,
    shard_index: int | None,
    max_runtime_seconds: int | None,
) -> None:
    """Migrate legacy File-backed debug files to Objectstore.

    With no options, runs the offline single-process walk used by self-hosted
    installs. The shard options run one durable SaaS migration shard.
    """
    indexed_options = (shard_count, shard_index, max_runtime_seconds)
    if any(value is not None for value in indexed_options):
        if any(value is None for value in indexed_options):
            raise click.UsageError(
                "--shard-count, --shard-index, and --max-runtime-seconds must be used together"
            )
        assert shard_count is not None
        assert shard_index is not None
        assert max_runtime_seconds is not None

        from sentry.debug_files.objectstore_migration import run_migration_shard

        result = run_migration_shard(
            shard_id=shard_index,
            shard_count=shard_count,
            max_runtime_seconds=max_runtime_seconds,
        )
        click.echo(f"Durable migration shard {shard_index} finished: {result.value}")
        return

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
