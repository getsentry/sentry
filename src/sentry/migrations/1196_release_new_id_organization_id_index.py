from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Kept out of Release.Meta.indexes on purpose: it twins a hand-built US-1 index that migration
# state has never known about, and the PK swap decides what becomes of both.
NEW_ID_ORG_INDEX = "sentry_release_new_id_organization_id"


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
        ("sentry", "1195_grouprulestatus_pending"),
    ]

    operations = [
        # A killed CREATE INDEX CONCURRENTLY leaves an invalid index a retry would collide with.
        SafeRunSQL(
            f'DROP INDEX CONCURRENTLY IF EXISTS "{NEW_ID_ORG_INDEX}"',
            reverse_sql=migrations.RunSQL.noop,
            hints={"tables": ["sentry_release"]},
            # The drop waits for open transactions, which can outlast the timeout.
            use_statement_timeout=False,
        ),
        SafeRunSQL(
            f'CREATE INDEX CONCURRENTLY "{NEW_ID_ORG_INDEX}" ON "sentry_release" ("new_id", "organization_id")',
            reverse_sql=f'DROP INDEX CONCURRENTLY IF EXISTS "{NEW_ID_ORG_INDEX}"',
            hints={"tables": ["sentry_release"]},
            # Prod's 10s statement timeout applies to post-deployment runs too.
            use_statement_timeout=False,
        ),
    ]
