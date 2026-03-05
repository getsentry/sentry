import django.db.models.deletion
from django.db import migrations, models

import sentry.db.models.fields.bounded
import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("workflow_engine", "0109_add_detector_state_triggered_date_index"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AlterField(
                    model_name="detector",
                    name="owner_team",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.team",
                    ),
                ),
            ],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="detector",
                    name="workflow_engine_detector_owner_constraints",
                ),
                migrations.RemoveField(
                    model_name="detector",
                    name="owner_team",
                ),
                migrations.AddField(
                    model_name="detector",
                    name="owner_team_id",
                    field=sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        blank=True, db_index=True, null=True
                    ),
                ),
                migrations.AddConstraint(
                    model_name="detector",
                    constraint=models.CheckConstraint(
                        condition=(
                            models.Q(owner_user_id__isnull=True, owner_team_id__isnull=False)
                            | models.Q(owner_user_id__isnull=False, owner_team_id__isnull=True)
                            | models.Q(owner_user_id__isnull=True, owner_team_id__isnull=True)
                        ),
                        name="workflow_engine_detector_owner_constraints",
                    ),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AlterField(
                    model_name="workflow",
                    name="owner_team",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        blank=True,
                        db_constraint=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.team",
                    ),
                ),
            ],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="workflow",
                    name="workflow_engine_workflow_owner_constraints",
                ),
                migrations.RemoveField(
                    model_name="workflow",
                    name="owner_team",
                ),
                migrations.AddField(
                    model_name="workflow",
                    name="owner_team_id",
                    field=sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        blank=True, db_index=True, null=True
                    ),
                ),
                migrations.AddConstraint(
                    model_name="workflow",
                    constraint=models.CheckConstraint(
                        condition=(
                            models.Q(owner_user_id__isnull=True, owner_team_id__isnull=False)
                            | models.Q(owner_user_id__isnull=False, owner_team_id__isnull=True)
                            | models.Q(owner_user_id__isnull=True, owner_team_id__isnull=True)
                        ),
                        name="workflow_engine_workflow_owner_constraints",
                    ),
                ),
            ],
        ),
    ]
