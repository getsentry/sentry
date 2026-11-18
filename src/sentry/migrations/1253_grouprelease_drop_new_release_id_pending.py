from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.special import SafeRunSQL
from sentry.new_migrations.monkey.state import DeletionAction

# 1252 runs by hand, so a deploy can reach a region before its swap has. There, new_release_id is
# still the wide column, and this code would stop filling it with no error.
REQUIRE_SWAP_SQL = """
DO $$
DECLARE
    release_id_attnum smallint;
    new_release_id_attnum smallint;
BEGIN
    SELECT attnum INTO STRICT release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'release_id';

    SELECT attnum INTO STRICT new_release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'new_release_id';

    -- A rename keeps attnum, so the original release_id having the lower one means no swap yet.
    IF release_id_attnum < new_release_id_attnum THEN
        RAISE EXCEPTION 'sentry_grouprelease is not swapped; run 1252 first';
    END IF;
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

    is_post_deployment = False

    dependencies = [
        ("sentry", "1252_grouprelease_swap_release_id"),
    ]

    operations = [
        SafeRunSQL(
            REQUIRE_SWAP_SQL,
            reverse_sql=migrations.RunSQL.noop,
            hints={"tables": ["sentry_grouprelease"]},
        ),
        SafeRemoveField(
            model_name="grouprelease",
            name="new_release_id",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
