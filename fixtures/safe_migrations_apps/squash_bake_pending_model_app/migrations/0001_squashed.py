from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    """A squash regenerated while TestTable is pending, with the pending op baked
    back in: CreateModel restores the table, SafeDeleteModel re-pends it in state."""

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="KeepTable",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
            ],
        ),
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
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
