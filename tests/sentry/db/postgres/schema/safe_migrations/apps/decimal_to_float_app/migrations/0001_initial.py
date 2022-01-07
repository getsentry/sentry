from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Value",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "amount",
                    models.DecimalField(
                        blank=True, decimal_places=4, default=None, max_digits=12, null=True
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
    ]
