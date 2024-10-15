from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("run_sql_app", "0002_run_sql"),
    ]

    operations = [
        migrations.AddField("testtable", "field", models.IntegerField(null=True)),
    ]
