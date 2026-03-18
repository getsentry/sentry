import django.db.models.deletion
import sentry.db.models.fields.foreignkey
from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = False

    dependencies = [
        ("sentry", "1055_rename_regiontombstone_to_celltombstone"),
    ]

    operations = [
        # Remove FK constraints on the through-table before deleting
        migrations.AlterField(
            model_name="customdynamicsamplingruleproject",
            name="custom_dynamic_sampling_rule",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False,
                on_delete=django.db.models.deletion.CASCADE,
                to="sentry.customdynamicsamplingrule",
            ),
        ),
        migrations.AlterField(
            model_name="customdynamicsamplingruleproject",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False,
                on_delete=django.db.models.deletion.CASCADE,
                to="sentry.project",
            ),
        ),
        # Remove FK constraint on the main table before deleting
        migrations.AlterField(
            model_name="customdynamicsamplingrule",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False,
                on_delete=django.db.models.deletion.CASCADE,
                to="sentry.organization",
            ),
        ),
        # Remove the M2M field before deleting the through-table
        migrations.RemoveField(
            model_name="customdynamicsamplingrule",
            name="projects",
        ),
        # Delete the through-table first, then the main table
        SafeDeleteModel(
            name="CustomDynamicSamplingRuleProject",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
        SafeDeleteModel(
            name="CustomDynamicSamplingRule",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
