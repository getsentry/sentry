import os

import click
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import F

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox

BATCH_SIZE = 1000
BATCHES_PER_CHECKPOINT = 1000
RESUME_FROM_ID_ENV_VAR = "GROUPRELEASE_BACKFILL_RESUME_FROM_ID"


def backfill_new_release_id(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    GroupRelease = apps.get_model("sentry", "GroupRelease")

    resume_from_value = os.environ.get(RESUME_FROM_ID_ENV_VAR)
    if resume_from_value:
        resume_from_id = int(resume_from_value)
        click.echo(f"Resuming from id {resume_from_id} ({RESUME_FROM_ID_ENV_VAR} is set)")
    else:
        resume_from_id = None

    rows = RangeQuerySetWrapperWithProgressBarApprox(
        GroupRelease.objects.all().values_list("id", "release_id", "new_release_id", named=True),
        step=BATCH_SIZE,
        min_id=resume_from_id,
        result_value_getter=lambda row: row.id,
    )
    batches = chunked(rows, BATCH_SIZE)
    for batch_number, batch in enumerate(batches, start=1):
        pending_ids = [row.id for row in batch if row.new_release_id != row.release_id]
        if pending_ids:
            GroupRelease.objects.filter(id__in=pending_ids).update(new_release_id=F("release_id"))

        if batch_number % BATCHES_PER_CHECKPOINT == 0:
            first_unprocessed_id = batch[-1].id + 1
            click.echo(
                f"\nCheckpoint: to resume from here, set {RESUME_FROM_ID_ENV_VAR}={first_unprocessed_id}"
            )


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
        ("sentry", "1232_backfill_commit_new_repository_id"),
    ]

    operations = [
        migrations.RunPython(
            backfill_new_release_id,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_grouprelease"]},
        ),
    ]
