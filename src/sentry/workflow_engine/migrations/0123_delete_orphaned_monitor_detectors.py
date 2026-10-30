from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.utils import timezone

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

PENDING_DELETION = 2
DELETION_IN_PROGRESS = 3

# Cron and uptime detectors are only reachable at runtime through their data
# source. One without a DataSourceDetector link never evaluates anything, and
# the API serializes it with `dataSources: null`, which breaks the monitor list.
MONITOR_DETECTOR_TYPES = frozenset({"monitor_check_in_failure", "uptime_domain_failure"})

BATCH_SIZE = 1000


def delete_orphaned_monitor_detectors(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    Detector = apps.get_model("workflow_engine", "Detector")
    DataSourceDetector = apps.get_model("workflow_engine", "DataSourceDetector")
    CellScheduledDeletion = apps.get_model("sentry", "CellScheduledDeletion")

    def flush(detector_ids: list[int]) -> None:
        linked = set(
            DataSourceDetector.objects.filter(detector_id__in=detector_ids).values_list(
                "detector_id", flat=True
            )
        )
        orphaned_ids = [detector_id for detector_id in detector_ids if detector_id not in linked]
        if not orphaned_ids:
            return

        # Hide immediately so the list pages recover, then let the deletion task
        # clean up the condition group and release any uptime seat.
        Detector.objects.filter(id__in=orphaned_ids).update(status=PENDING_DELETION)
        now = timezone.now()
        for detector_id in orphaned_ids:
            CellScheduledDeletion.objects.get_or_create(
                app_label="workflow_engine",
                model_name="Detector",
                object_id=detector_id,
                defaults={"date_scheduled": now},
            )

    # No index on type, so scan by id and filter in memory.
    candidate_ids: list[int] = []
    for detector_id, detector_type, status in RangeQuerySetWrapperWithProgressBar(
        Detector.objects.values_list("id", "type", "status"),
        step=BATCH_SIZE,
        result_value_getter=lambda item: item[0],
    ):
        if detector_type not in MONITOR_DETECTOR_TYPES:
            continue
        if status in (PENDING_DELETION, DELETION_IN_PROGRESS):
            continue
        candidate_ids.append(detector_id)
        if len(candidate_ids) >= BATCH_SIZE:
            flush(candidate_ids)
            candidate_ids = []

    if candidate_ids:
        flush(candidate_ids)


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
        ("sentry", "1248_add_dashboard_non_user_creator"),
        ("workflow_engine", "0122_sync_cron_detector_enabled"),
    ]

    operations = [
        migrations.RunPython(
            delete_orphaned_monitor_detectors,
            reverse_code=migrations.RunPython.noop,
            hints={
                "tables": [
                    "workflow_engine_detector",
                    "workflow_engine_datasourcedetector",
                    "sentry_regionscheduleddeletion",
                ]
            },
        ),
    ]
