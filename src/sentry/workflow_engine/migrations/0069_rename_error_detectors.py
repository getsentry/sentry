import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)


def rename_error_detectors(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Detector = apps.get_model("workflow_engine", "Detector")

    for detector in RangeQuerySetWrapperWithProgressBar(Detector.objects.all()):
        if detector.type == "error":
            detector.name = "Error Monitor"
            detector.save()


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
        ("workflow_engine", "0068_migrate_anomaly_detection_alerts"),
    ]

    operations = [
        migrations.RunPython(
            code=rename_error_detectors,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_detector"]},
        ),
    ]
