from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


def set_existing_apps_to_allow_prefix(apps, schema_editor):
    ApiApplication = apps.get_model("sentry", "ApiApplication")
    # Existing applications should continue to allow legacy prefix matching.
    ApiApplication.objects.all().update(allow_redirect_prefix_match=True)


class Migration(CheckedMigration):
    dependencies = [
        ("sentry", "0973_safe_del_dashboardwidgetsnapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="apiapplication",
            name="allow_redirect_prefix_match",
            field=models.BooleanField(default=False, db_default=False),
        ),
        migrations.RunPython(
            set_existing_apps_to_allow_prefix,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_apiapplication"]},
        ),
    ]
