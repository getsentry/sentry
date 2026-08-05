from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    dependencies = [
        ("bad_flow_reverse_char_type_narrowing_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="testtable",
            name="field",
            field=models.CharField(max_length=120, null=True),
        ),
    ]
