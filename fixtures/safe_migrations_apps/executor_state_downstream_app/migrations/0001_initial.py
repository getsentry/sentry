from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    initial = True
    # Depends only on the upstream app's 0001, not its 0002.
    dependencies = [
        ("executor_state_upstream_app", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Downstream",
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
