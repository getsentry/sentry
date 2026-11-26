from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Only US-1 has these two checks; the model declares neither, so every other region is a no-op.
# Post-deployment so a lock timeout fails a manual run instead of a deploy.
DROP_CHECKS_SQL = """
DO $$
BEGIN
    -- Waiting here queues every statement on a hot table, so give up fast; re-run on timeout.
    SET LOCAL lock_timeout = '2s';
    ALTER TABLE sentry_grouprelease
        DROP CONSTRAINT IF EXISTS sentry_grouprelease_group_id_check,
        DROP CONSTRAINT IF EXISTS sentry_grouprelease_project_id_check;
END $$;
"""


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
        ("sentry", "1254_grouprelease_drop_new_release_id"),
    ]

    operations = [
        SafeRunSQL(
            DROP_CHECKS_SQL,
            reverse_sql=migrations.RunSQL.noop,
            hints={"tables": ["sentry_grouprelease"]},
        ),
    ]
