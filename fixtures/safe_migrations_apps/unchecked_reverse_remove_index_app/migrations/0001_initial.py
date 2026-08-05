from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TestTable",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("name", models.CharField(max_length=32, null=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="testtable",
            index=models.Index(fields=["name"], name="test_unchecked_name_idx"),
        ),
    ]
