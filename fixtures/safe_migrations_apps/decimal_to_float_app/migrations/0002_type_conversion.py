from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):

    dependencies = [
        ("decimal_to_float_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="value",
            name="amount",
            field=models.FloatField(blank=True, default=None, null=True),
        ),
    ]
