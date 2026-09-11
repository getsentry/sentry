from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    """A squash regenerated while `field` is pending, with the pending op baked back
    in: AddField restores the physical column, SafeRemoveField re-pends it in state."""

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
        SafeRemoveField(
            model_name="testtable",
            name="field",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
