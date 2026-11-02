from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    """A baked squash for two interdependent pending models. Alpha relates to Zebra, so
    Zebra's CreateModel is emitted first (the order the bake now produces) or Alpha's
    relation cannot resolve on a fresh database."""

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
            name="Zebra",
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
            name="Alpha",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "zebra",
                    models.ForeignKey(
                        db_constraint=False,
                        db_index=False,
                        null=True,
                        on_delete=models.DO_NOTHING,
                        to="squash_bake_related_models_app.zebra",
                    ),
                ),
            ],
        ),
        SafeDeleteModel(name="Alpha", deletion_action=DeletionAction.MOVE_TO_PENDING),
        SafeDeleteModel(name="Zebra", deletion_action=DeletionAction.MOVE_TO_PENDING),
    ]
