from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [
        ("sentry", "1061_eventattachment_date_expires_index"),
    ]

    operations = [
        migrations.RunPython(
            migrations.RunPython.noop,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_eventattachment"]},
        ),
    ]
