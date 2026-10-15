from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# The 1207 primary key swap re-added these foreign keys NOT VALID. Constraint names differ per
# region, so each table's are looked up rather than named.
REFERENCING_TABLES = [
    "sentry_deploy",
    "sentry_distribution",
    "sentry_groupresolution",
    "sentry_release_project",
    "sentry_releaseactivity",
    "sentry_releasecommit",
    "sentry_releaseheadcommit",
    "sentry_releaseprojectenvironment",
    # Last because it is the largest; how long its scan takes in US-1 is unknown. The scan holds
    # ROW SHARE on sentry_release throughout, so a statement needing an exclusive lock on
    # sentry_release waits behind it, and app traffic then queues behind that statement.
    "sentry_groupedmessage",
]


def validate_sql(table: str) -> str:
    return f"""
DO $$
DECLARE
    fk_name text;
BEGIN
    FOR fk_name IN
        SELECT conname
        FROM pg_constraint
        WHERE contype = 'f'
          AND conrelid = '{table}'::regclass
          AND confrelid = 'sentry_release'::regclass
          AND NOT convalidated
    LOOP
        EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', '{table}', fk_name);
    END LOOP;
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
        ("sentry", "1209_update_if_syntax_on_dashboard_spans"),
    ]

    operations = [
        SafeRunSQL(
            validate_sql(table),
            reverse_sql=migrations.RunSQL.noop,
            hints={"tables": [table]},
            # Each validation scans its whole table, which outlasts prod's 10s statement timeout.
            use_statement_timeout=False,
        )
        for table in REFERENCING_TABLES
    ]
