import sentry.db.models.fields.bounded
from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# `migrations run` executes the operation without consulting django_migrations, so a second
# manual run would rotate the columns straight back. The guard makes a re-run a no-op.
SWAP_SQL = """
DO $$
DECLARE
    deploy_id_type text;
    shadow_type text;
BEGIN
    SELECT data_type INTO deploy_id_type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sentry_release'
      AND column_name = 'last_deploy_id';

    SELECT data_type INTO shadow_type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sentry_release'
      AND column_name = 'new_last_deploy_id';

    IF deploy_id_type = 'bigint' AND shadow_type = 'integer' THEN
        RAISE NOTICE 'sentry_release.last_deploy_id is already the wide column; nothing to do';
        RETURN;
    END IF;

    ALTER TABLE "sentry_release" RENAME COLUMN "last_deploy_id" TO "last_deploy_id_tmp";
    ALTER TABLE "sentry_release" RENAME COLUMN "new_last_deploy_id" TO "last_deploy_id";
    ALTER TABLE "sentry_release" RENAME COLUMN "last_deploy_id_tmp" TO "new_last_deploy_id";
END $$;
"""

UNSWAP_SQL = [
    'ALTER TABLE "sentry_release" RENAME COLUMN "new_last_deploy_id" TO "last_deploy_id_tmp";',
    'ALTER TABLE "sentry_release" RENAME COLUMN "last_deploy_id" TO "new_last_deploy_id";',
    'ALTER TABLE "sentry_release" RENAME COLUMN "last_deploy_id_tmp" TO "last_deploy_id";',
]


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

    # The base class opts out of transactions for long-running backfills. This one is the
    # opposite: stopping between the renames leaves the table with no last_deploy_id at all.
    atomic = True

    dependencies = [
        ("sentry", "1179_add_dashboard_scopes"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                SafeRunSQL(
                    SWAP_SQL,
                    reverse_sql=UNSWAP_SQL,
                    hints={"tables": ["sentry_release"]},
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="release",
                    name="last_deploy_id",
                    field=sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
                ),
                migrations.AlterField(
                    model_name="release",
                    name="new_last_deploy_id",
                    field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
            ],
        ),
    ]
