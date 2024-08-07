# Generated by Django 5.0.6 on 2024-07-17 08:41

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


def backfill_broken_monitor_notification_setting_option(
    apps: Apps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    NotificationSettingOption = apps.get_model("sentry", "NotificationSettingOption")

    # No index on the type column, so scan all rows manually to avoid timing out
    notif_settings = NotificationSettingOption.objects.all()
    for setting in RangeQuerySetWrapperWithProgressBar(notif_settings):
        if setting.type == "approval":
            NotificationSettingOption.objects.get_or_create(
                user_id=setting.user_id,
                scope_type=setting.scope_type,
                scope_identifier=setting.scope_identifier,
                type="brokenMonitors",
                defaults={"value": setting.value},
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
        ("sentry", "0742_backfill_alertrule_detection_type"),
    ]

    operations = [
        migrations.RunPython(
            backfill_broken_monitor_notification_setting_option,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_notificationsettingoption"]},
        )
    ]
