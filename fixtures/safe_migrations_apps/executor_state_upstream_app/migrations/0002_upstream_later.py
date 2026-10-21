from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    dependencies = [
        ("executor_state_upstream_app", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="UpstreamLater",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
            ],
        ),
    ]
