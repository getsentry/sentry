from __future__ import annotations

import click

from sentry.runner.decorators import configuration


@click.command("migrate_preprod_to_objectstore")
@click.option(
    "--start-from",
    type=click.IntRange(min=0),
    default=0,
    show_default=True,
    help="First preprod artifact ID to inspect (inclusive).",
)
@click.option(
    "--dry-run", is_flag=True, help="Count eligible payloads without copying or deleting files."
)
@configuration
def migrate_preprod_to_objectstore(start_from: int, dry_run: bool) -> None:
    """Move legacy preprod build files and reports to Objectstore."""
    from sentry.preprod.models import PreprodArtifact
    from sentry.preprod.objectstore_migration import legacy_payloads, migrate_payload

    builds = PreprodArtifact.objects.select_related("project__organization").order_by("id")
    total = 0
    cursor = start_from
    while batch := list(builds.filter(id__gte=cursor)[:100]):
        for artifact in batch:
            click.echo(f"Inspecting artifact {artifact.id}. Resume with START_FROM={artifact.id}")
            for payload in legacy_payloads(artifact):
                if dry_run or migrate_payload(artifact, payload):
                    total += 1
        cursor = batch[-1].id + 1

    click.echo(f"{'Eligible' if dry_run else 'Migrated'} payloads: {total}")
