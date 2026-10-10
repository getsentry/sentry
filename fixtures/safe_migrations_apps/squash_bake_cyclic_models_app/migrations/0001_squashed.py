from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction

APP = "squash_bake_cyclic_models_app"


class Migration(CheckedMigration):
    """A baked squash for two mutually-referencing pending models, shaped the way the
    bake now emits it: both tables are created without their circular FKs, the FKs are
    added afterward, then both models are moved to pending. This is the investigations
    cell-model shape and must apply on a fresh database."""

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
            name="Cell",
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
            name="Execution",
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
            model_name="cell",
            name="execution",
            field=models.ForeignKey(
                db_constraint=False,
                db_index=False,
                null=True,
                on_delete=models.DO_NOTHING,
                to=f"{APP}.execution",
            ),
        ),
        migrations.AddField(
            model_name="execution",
            name="cell",
            field=models.ForeignKey(
                db_constraint=False,
                db_index=False,
                null=True,
                on_delete=models.DO_NOTHING,
                to=f"{APP}.cell",
            ),
        ),
        SafeDeleteModel(name="Cell", deletion_action=DeletionAction.MOVE_TO_PENDING),
        SafeDeleteModel(name="Execution", deletion_action=DeletionAction.MOVE_TO_PENDING),
    ]
