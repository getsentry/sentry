import click
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import Exists, OuterRef

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

BATCH_SIZE = 1000
# GoCD kills a job after 12h without console output.
BATCHES_PER_PROGRESS_LINE = 100


def backfill_has_debug_ids(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    ProjectArtifactBundle = apps.get_model("sentry", "ProjectArtifactBundle")
    DebugIdArtifactBundle = apps.get_model("sentry", "DebugIdArtifactBundle")

    # No `has_debug_ids` filter here, so the scan reads only the primary key index.
    link_ids = RangeQuerySetWrapper(
        ProjectArtifactBundle.objects.values_list("id", flat=True),
        step=BATCH_SIZE,
        result_value_getter=lambda link_id: link_id,
    )
    for batch_number, batch in enumerate(chunked(link_ids, BATCH_SIZE), start=1):
        # One probe per link in the debug-ID rows' `artifact_bundle_id` index, which stops at the first row.
        ProjectArtifactBundle.objects.filter(id__in=batch, has_debug_ids=False).filter(
            Exists(
                DebugIdArtifactBundle.objects.filter(
                    artifact_bundle_id=OuterRef("artifact_bundle_id")
                )
            )
        ).update(has_debug_ids=True)

        if batch_number % BATCHES_PER_PROGRESS_LINE == 0:
            click.echo(f"Backfilled through id {batch[-1]}")


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "1259_add_projectartifactbundle_has_debug_ids"),
    ]

    operations = [
        migrations.RunPython(
            backfill_has_debug_ids,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_projectartifactbundle"]},
        ),
    ]
