from django.db import migrations, models

import sentry.db.models.fields.bounded
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    initial = True
    is_post_deployment = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="MigrationRunTest",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        primary_key=True, serialize=False
                    ),
                ),
                ("name", models.CharField(max_length=255)),
            ],
        ),
        migrations.AddIndex(
            model_name="migrationruntest",
            index=models.Index(name="migration_run_test_name_idx", fields=["name"]),
        ),
    ]
