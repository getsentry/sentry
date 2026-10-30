from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
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
                (
                    "cell",
                    models.ForeignKey(
                        db_constraint=False,
                        db_index=False,
                        null=True,
                        on_delete=models.DO_NOTHING,
                        to="bake_cyclic_pending_models_app.cell",
                    ),
                ),
            ],
            # An index and a unique constraint on the cyclic FK column, which are
            # deferred out of the CreateModel and re-emitted after AddField.
            options={
                "indexes": [models.Index(fields=["cell"], name="cyclic_exec_cell_idx")],
                "constraints": [
                    models.UniqueConstraint(fields=["cell"], name="cyclic_exec_cell_uniq")
                ],
            },
        ),
        migrations.AddField(
            model_name="cell",
            name="execution",
            field=models.ForeignKey(
                db_constraint=False,
                db_index=False,
                null=True,
                on_delete=models.DO_NOTHING,
                to="bake_cyclic_pending_models_app.execution",
            ),
        ),
        # An explicit m2m `through` that is itself a pending model. Django's create_model
        # touches through._meta, so the m2m must be held back until the through table
        # exists — exercises the through-is-pending deferral path.
        migrations.CreateModel(
            name="Link",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "cell",
                    models.ForeignKey(
                        db_constraint=False,
                        db_index=False,
                        on_delete=models.DO_NOTHING,
                        to="bake_cyclic_pending_models_app.cell",
                    ),
                ),
                (
                    "execution",
                    models.ForeignKey(
                        db_constraint=False,
                        db_index=False,
                        on_delete=models.DO_NOTHING,
                        to="bake_cyclic_pending_models_app.execution",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="execution",
            name="linked_cells",
            field=models.ManyToManyField(
                through="bake_cyclic_pending_models_app.Link",
                to="bake_cyclic_pending_models_app.cell",
            ),
        ),
    ]
