from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Twins of release_id's indexes, for a later migration that swaps the two columns by rename.
# Kept out of Django state: after the rename, release_id's unique_together and db_index cover them.
# A bare index: that migration's ADD CONSTRAINT ... USING INDEX refuses a constraint-owned one.
UNIQUE_INDEX_NAME = "sentry_grouprelease_group_id_new_release_id_environment_uniq"
INDEX_NAME = "sentry_grouprelease_new_release_id"


# A killed CONCURRENTLY build leaves an INVALID index that IF NOT EXISTS would keep.
def drop_invalid_indexes(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    for name in (UNIQUE_INDEX_NAME, INDEX_NAME):
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass(%s)", [name]
            )
            row = cursor.fetchone()
        if row is None:
            continue
        is_valid = row[0]
        if is_valid:
            continue
        # Left at 0: the drop waits on open transactions, and the builds below run untimed too.
        schema_editor.execute("SET statement_timeout TO 0")
        schema_editor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')


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
        ("sentry", "1233_backfill_grouprelease_new_release_id"),
    ]

    operations = [
        migrations.RunPython(
            drop_invalid_indexes,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_grouprelease"]},
        ),
        SafeRunSQL(
            f'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "{UNIQUE_INDEX_NAME}" ON "sentry_grouprelease" ("group_id", "new_release_id", "environment")',
            reverse_sql=f'DROP INDEX CONCURRENTLY IF EXISTS "{UNIQUE_INDEX_NAME}"',
            hints={"tables": ["sentry_grouprelease"]},
            # Prod's 10s statement timeout applies to post-deployment runs too.
            use_statement_timeout=False,
        ),
        SafeRunSQL(
            f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{INDEX_NAME}" ON "sentry_grouprelease" ("new_release_id")',
            reverse_sql=f'DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}"',
            hints={"tables": ["sentry_grouprelease"]},
            use_statement_timeout=False,
        ),
    ]
