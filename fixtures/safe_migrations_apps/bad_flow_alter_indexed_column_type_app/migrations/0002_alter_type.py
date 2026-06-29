from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    dependencies = [
        ("bad_flow_alter_indexed_column_type_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="testtable",
            name="field",
            field=models.CharField(max_length=200),
        ),
    ]
