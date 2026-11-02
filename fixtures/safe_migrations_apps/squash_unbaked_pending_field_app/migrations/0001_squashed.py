from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    """The same squash WITHOUT the baked pending op. The column is present but was
    never re-pended, so the pending registry is empty after this migration."""

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
            ],
        ),
        migrations.AddField(
            model_name="testtable",
            name="field",
            field=models.IntegerField(null=True),
        ),
    ]
