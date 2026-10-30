from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    dependencies = [
        ("good_flow_drop_not_null_with_check_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="testtable",
            name="field",
            field=models.IntegerField(null=True),
        ),
    ]
