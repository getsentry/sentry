from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

# NotificationSource values whose threads are about a group, keyed by key_data["group_id"]
GROUP_KEY_TYPES = ("issue", "metric-alert")


def backfill_object(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    NotificationThread = apps.get_model("notifications", "NotificationThread")

    threads = NotificationThread.objects.filter(
        key_type__in=GROUP_KEY_TYPES, object_type__isnull=True
    )
    for thread in RangeQuerySetWrapperWithProgressBar(threads):
        group_id = thread.key_data.get("group_id")
        if group_id is None:
            continue
        thread.object_type = "group"
        thread.object_id = int(group_id)
        thread.save(update_fields=["object_type", "object_id"])


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
        ("notifications", "0014_add_notificationthread_object"),
    ]

    operations = [
        migrations.RunPython(
            backfill_object,
            migrations.RunPython.noop,
            hints={"tables": ["notifications_notificationthread"]},
        ),
    ]
