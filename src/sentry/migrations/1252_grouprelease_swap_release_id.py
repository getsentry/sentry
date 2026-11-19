import sentry.db.models.fields.bounded
from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Django's generated names for these columns' constraints and indexes.
UNIQUE_NAME = "sentry_grouprelease_group_id_release_id_envi_044354c8_uniq"
RELEASE_ID_INDEX = "sentry_grouprelease_release_id_f0ccbbfc"
NEW_RELEASE_ID_INDEX = "sentry_grouprelease_new_release_id_9a0f50dc"
RELEASE_ID_CHECK = "sentry_grouprelease_release_id_check"
NEW_RELEASE_ID_CHECK = "sentry_grouprelease_new_release_id_check"

# The twins 1234 built on new_release_id, under the same names in every region.
UNIQUE_TWIN = "sentry_grouprelease_group_id_new_release_id_environment_uniq"
INDEX_TWIN = "sentry_grouprelease_new_release_id"

# `migrations run` ignores django_migrations, so a manual re-run would swap the columns back.
# The guard compares attnum, which a rename keeps: the original release_id has the lower one.
# The old unique, index and check have different names per region, so they are found by column.
SWAP_SQL = f"""
DO $$
DECLARE
    release_id_attnum smallint;
    new_release_id_attnum smallint;
    old_unique_name text;
    old_index_name text;
    old_check_name text;
    twin_is_usable boolean;
BEGIN
    -- Waiting here queues every statement on a hot table, so give up fast; re-run on timeout.
    SET LOCAL lock_timeout = '2s';
    LOCK TABLE "sentry_grouprelease" IN ACCESS EXCLUSIVE MODE;

    SELECT attnum INTO STRICT release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'release_id';

    SELECT attnum INTO STRICT new_release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'new_release_id';

    IF release_id_attnum > new_release_id_attnum THEN
        RAISE NOTICE 'sentry_grouprelease.release_id is already the wide column; nothing to do';
        RETURN;
    END IF;

    SELECT conname INTO STRICT old_unique_name
    FROM pg_constraint
    WHERE conrelid = 'sentry_grouprelease'::regclass
      AND contype = 'u'
      AND release_id_attnum = ANY(conkey);

    SELECT index_class.relname INTO STRICT old_index_name
    FROM pg_index
    JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid
    WHERE pg_index.indrelid = 'sentry_grouprelease'::regclass
      AND pg_index.indnatts = 1
      AND pg_index.indkey[0] = release_id_attnum;

    SELECT conname INTO old_check_name
    FROM pg_constraint
    WHERE conrelid = 'sentry_grouprelease'::regclass
      AND contype = 'c'
      AND conkey = ARRAY[release_id_attnum];

    -- Renaming would accept an invalid index; USING INDEX already rejects an invalid unique twin.
    SELECT indisvalid AND indisready INTO twin_is_usable
    FROM pg_index
    WHERE indexrelid = to_regclass('{INDEX_TWIN}');

    IF twin_is_usable IS NOT TRUE THEN
        RAISE EXCEPTION '{INDEX_TWIN} is missing or invalid; rerun 1234 first';
    END IF;

    EXECUTE format('ALTER TABLE "sentry_grouprelease" DROP CONSTRAINT %I', old_unique_name);

    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "release_id" TO "release_id_tmp";
    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "new_release_id" TO "release_id";
    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "release_id_tmp" TO "new_release_id";

    -- The narrow column stops being written before it is dropped.
    ALTER TABLE "sentry_grouprelease" ALTER COLUMN "new_release_id" DROP NOT NULL;

    ALTER TABLE "sentry_grouprelease"
        ADD CONSTRAINT "{UNIQUE_NAME}" UNIQUE USING INDEX "{UNIQUE_TWIN}";

    -- The old index first: it may already hold the name the twin takes.
    EXECUTE format('ALTER INDEX %I RENAME TO %I', old_index_name, '{NEW_RELEASE_ID_INDEX}');
    ALTER INDEX "{INDEX_TWIN}" RENAME TO "{RELEASE_ID_INDEX}";

    IF old_check_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE "sentry_grouprelease" RENAME CONSTRAINT %I TO %I',
            old_check_name, '{NEW_RELEASE_ID_CHECK}'
        );
    END IF;
END $$;
"""

# Builds both unique indexes inside the lock, so it is for tests and local work, not a
# production rollback plan.
UNSWAP_SQL = f"""
DO $$
DECLARE
    release_id_attnum smallint;
    new_release_id_attnum smallint;
BEGIN
    LOCK TABLE "sentry_grouprelease" IN ACCESS EXCLUSIVE MODE;

    SELECT attnum INTO STRICT release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'release_id';

    SELECT attnum INTO STRICT new_release_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'sentry_grouprelease'::regclass AND attname = 'new_release_id';

    IF release_id_attnum < new_release_id_attnum THEN
        RAISE NOTICE 'sentry_grouprelease.release_id is already the narrow column; nothing to do';
        RETURN;
    END IF;

    ALTER TABLE "sentry_grouprelease" DROP CONSTRAINT "{UNIQUE_NAME}";

    ALTER TABLE "sentry_grouprelease" ALTER COLUMN "new_release_id" SET NOT NULL;

    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "new_release_id" TO "release_id_tmp";
    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "release_id" TO "new_release_id";
    ALTER TABLE "sentry_grouprelease" RENAME COLUMN "release_id_tmp" TO "release_id";

    ALTER INDEX "{RELEASE_ID_INDEX}" RENAME TO "{INDEX_TWIN}";
    ALTER INDEX "{NEW_RELEASE_ID_INDEX}" RENAME TO "{RELEASE_ID_INDEX}";

    ALTER TABLE "sentry_grouprelease"
        ADD CONSTRAINT "{UNIQUE_NAME}" UNIQUE ("group_id", "release_id", "environment");
    CREATE UNIQUE INDEX "{UNIQUE_TWIN}"
        ON "sentry_grouprelease" ("group_id", "new_release_id", "environment");

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sentry_grouprelease'::regclass AND conname = '{NEW_RELEASE_ID_CHECK}'
    ) THEN
        ALTER TABLE "sentry_grouprelease"
            RENAME CONSTRAINT "{NEW_RELEASE_ID_CHECK}" TO "{RELEASE_ID_CHECK}";
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

    is_post_deployment = True

    # The base class opts out of transactions for long-running backfills. This one is the
    # opposite: stopping between the renames leaves the table with no release_id at all.
    atomic = True

    dependencies = [
        ("sentry", "1251_add_apisetupcode"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                SafeRunSQL(
                    SWAP_SQL,
                    reverse_sql=UNSWAP_SQL,
                    hints={"tables": ["sentry_grouprelease"]},
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="grouprelease",
                    name="release_id",
                    field=sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True),
                ),
                migrations.AlterField(
                    model_name="grouprelease",
                    name="new_release_id",
                    field=sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        db_index=True, null=True
                    ),
                ),
            ],
        ),
    ]
