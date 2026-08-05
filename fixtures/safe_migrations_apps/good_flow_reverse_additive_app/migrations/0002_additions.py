from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    dependencies = [
        ("good_flow_reverse_additive_app", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="testtable",
            name="field",
            field=models.IntegerField(null=True),
        ),
        migrations.CreateModel(
            name="SecondTable",
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
