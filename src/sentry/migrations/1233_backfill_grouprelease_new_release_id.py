import click
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import F, Max

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox
from sentry.utils.redis import redis_clusters

BATCH_SIZE = 1000
# GoCD kills a job after 12h without console output, and the progress bar prints nothing off a TTY.
BATCHES_PER_PROGRESS_LINE = 1000
RESUME_ID_KEY = "migrations:1233_backfill_grouprelease_new_release_id:resume_id"
RESUME_ID_TTL_SECONDS = 7 * 24 * 60 * 60


def backfill_new_release_id(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    GroupRelease = apps.get_model("sentry", "GroupRelease")
    redis_client = redis_clusters.get("default")

    stored_resume_id = redis_client.get(RESUME_ID_KEY)
    if stored_resume_id is None:
        resume_id = None
    else:
        resume_id = int(stored_resume_id)
        click.echo(f"Resuming from id {resume_id}, read from Redis key {RESUME_ID_KEY}")

    id_bounds = GroupRelease.objects.aggregate(max_id=Max("id"))
    max_id = id_bounds["max_id"]

    rows = RangeQuerySetWrapperWithProgressBarApprox(
        GroupRelease.objects.all().values_list("id", "release_id", "new_release_id", named=True),
        step=BATCH_SIZE,
        min_id=resume_id,
        result_value_getter=lambda row: row.id,
    )
    batches = chunked(rows, BATCH_SIZE)
    for batch_number, batch in enumerate(batches, start=1):
        pending_ids = [row.id for row in batch if row.new_release_id != row.release_id]
        if pending_ids:
            GroupRelease.objects.filter(id__in=pending_ids).update(new_release_id=F("release_id"))

        last_id = batch[-1].id
        first_unprocessed_id = last_id + 1
        redis_client.set(RESUME_ID_KEY, first_unprocessed_id, ex=RESUME_ID_TTL_SECONDS)

        if batch_number % BATCHES_PER_PROGRESS_LINE == 0:
            click.echo(f"\nBackfilled through id {last_id} of max id {max_id}")

    redis_client.delete(RESUME_ID_KEY)


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
