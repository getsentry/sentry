from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

# Detectors are deleted in batches so that each cascade stays small and no single
# statement holds locks on the related tables for a long time.
BATCH_SIZE = 100


def delete_all_project_detectors(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """
    Reverses 0117_backfill_all_project_detectors by removing every project-less
    `issue_stream` detector.

    There is no index on (project_id, type), so a filtered keyset scan would have
    to read many rows per page. Instead we page over the primary key alone -- each
    page is a plain index range scan -- and apply the filter in memory.
    """
    Detector = apps.get_model("workflow_engine", "Detector")

    batch: list[int] = []
    for detector_id, project_id, detector_type in RangeQuerySetWrapperWithProgressBar(
        Detector.objects.all().values_list("id", "project_id", "type"),
        result_value_getter=lambda item: item[0],
    ):
        if project_id is not None or detector_type != "issue_stream":
            continue

        batch.append(detector_id)
        if len(batch) >= BATCH_SIZE:
            Detector.objects.filter(id__in=batch).delete()
            batch = []

    if batch:
        Detector.objects.filter(id__in=batch).delete()


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
        ("workflow_engine", "0118_repair_latest_adopted_release_environments"),
    ]

    operations = [
        migrations.RunPython(
            delete_all_project_detectors,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_detector"]},
        ),
    ]
