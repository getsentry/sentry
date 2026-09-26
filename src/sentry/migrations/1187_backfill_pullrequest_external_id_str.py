from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import TextField
from django.db.models.functions import Cast

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox

BATCH_SIZE = 10000


def backfill_external_id_str(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    PullRequest = apps.get_model("sentry", "PullRequest")
    rows = RangeQuerySetWrapperWithProgressBarApprox(
        PullRequest.objects.all().values_list("id", "external_id", "external_id_str", named=True),
        step=BATCH_SIZE,
        result_value_getter=lambda row: row.id,
    )
    for batch in chunked(rows, BATCH_SIZE):
        pending_ids = [
            row.id for row in batch if row.external_id is not None and row.external_id_str is None
        ]
        if pending_ids:
            # The IS NULL guard leaves anything a webhook wrote since the read alone.
            PullRequest.objects.filter(id__in=pending_ids, external_id_str__isnull=True).update(
                external_id_str=Cast("external_id", TextField())
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
        ("sentry", "1186_pullrequest_external_id_str"),
    ]

    operations = [
        migrations.RunPython(
            backfill_external_id_str,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_pull_request"]},
        ),
    ]
