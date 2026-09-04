from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper

# The data type each condition read a field of, from before a filter stored its own.
# Repeated here because a migration must not follow later edits to the model.
DATA_TYPE_BY_CONDITION_TYPE = {
    "error_type": "error",
    "error_message": "error",
    "log_message": "log",
    "metric_name": "metric",
}


def backfill_data_type(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """
    Gives every filter written before the column the data type it was matched against.

    A filter used to take its data type from the first condition that named one, and to
    fall back to errors. The new column defaults to errors, so only the filters whose
    conditions named another data type need writing.
    """
    CustomInboundFilter = apps.get_model("sentry", "CustomInboundFilter")

    for custom_filter in RangeQuerySetWrapper(CustomInboundFilter.objects.all()):
        data_type = next(
            (
                DATA_TYPE_BY_CONDITION_TYPE[condition["type"]]
                for condition in custom_filter.conditions
                if condition.get("type") in DATA_TYPE_BY_CONDITION_TYPE
            ),
            "error",
        )
        if data_type != custom_filter.data_type:
            custom_filter.data_type = data_type
            custom_filter.save(update_fields=["data_type"])


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
        ("sentry", "1164_custominboundfilter_add_data_type"),
    ]

    operations = [
        migrations.RunPython(
            backfill_data_type,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_custominboundfilter"]},
        ),
    ]
