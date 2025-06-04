from django.db import migrations

from sentry.db.models import BoundedPositiveIntegerField
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("safe_run_sql_app", "0002_run_sql"),
    ]

    operations = [
        migrations.AlterField("testtable", "field", BoundedPositiveIntegerField(null=True)),
    ]
