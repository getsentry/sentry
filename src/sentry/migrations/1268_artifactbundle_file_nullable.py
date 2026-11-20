import django.db.models.deletion
from django.db import migrations

import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


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

    is_post_deployment = True

    dependencies = [
        ("sentry", "1267_drop_debugidartifactbundle_source_file_type"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # `AlterField` on a foreign key drops and re-adds the constraint, which needs a lock on
            # `sentry_file` too. Only the `NOT NULL` needs to go, and dropping it is a no-op in
            # regions where an earlier version of 1266 already made the column nullable.
            database_operations=[
                SafeRunSQL(
                    'ALTER TABLE "sentry_artifactbundle" ALTER COLUMN "file_id" DROP NOT NULL',
                    reverse_sql='ALTER TABLE "sentry_artifactbundle" ALTER COLUMN "file_id" SET NOT NULL',
                    hints={"tables": ["sentry_artifactbundle"]},
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="artifactbundle",
                    name="file",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True, on_delete=django.db.models.deletion.CASCADE, to="sentry.file"
                    ),
                ),
            ],
        ),
    ]
