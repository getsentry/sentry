import sentry.db.models.fields.bounded
from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Prod's id is sequence-backed and a fresh migration run gets an identity column, so both
# shapes are handled. The rebuilt sequence keeps the table's name: _reserve_ids needs it.
SWAP_SQL = """
DO $$
DECLARE
    next_id bigint;
    pk_name text;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'sentry_organizationmember_teams'
          AND column_name = 'id'
          AND is_identity = 'YES'
    ) THEN
        -- Read the mark first: dropping the identity takes its sequence with it.
        SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
        INTO next_id
        FROM "sentry_organizationmember_teams_id_seq";

        ALTER TABLE "sentry_organizationmember_teams" ALTER COLUMN "id" DROP IDENTITY;
        -- Rebuild under the same name, resuming where the identity left off.
        EXECUTE format(
            'CREATE SEQUENCE "sentry_organizationmember_teams_id_seq" AS bigint '
            'START WITH %s OWNED BY "sentry_organizationmember_teams"."new_id"',
            next_id
        );
    ELSE
        -- A plain sequence can simply be moved across, keeping its position untouched.
        ALTER TABLE "sentry_organizationmember_teams" ALTER COLUMN "id" DROP DEFAULT;
        ALTER SEQUENCE "sentry_organizationmember_teams_id_seq"
            OWNED BY "sentry_organizationmember_teams"."new_id";
        ALTER SEQUENCE "sentry_organizationmember_teams_id_seq" AS bigint;
    END IF;

    ALTER TABLE "sentry_organizationmember_teams"
        ALTER COLUMN "new_id" SET DEFAULT nextval('sentry_organizationmember_teams_id_seq');

    -- Postgres owns this name, so look it up rather than hardcode a guess.
    SELECT constraint_name INTO pk_name
    FROM information_schema.table_constraints
    WHERE table_schema = current_schema()
      AND table_name = 'sentry_organizationmember_teams'
      AND constraint_type = 'PRIMARY KEY';

    EXECUTE format(
        'ALTER TABLE "sentry_organizationmember_teams" DROP CONSTRAINT %I', pk_name
    );

    -- Naming the constraint renames the prebuilt index onto it, so the key keeps its old name.
    EXECUTE format(
        'ALTER TABLE "sentry_organizationmember_teams" ADD CONSTRAINT %I '
        'PRIMARY KEY USING INDEX "sentry_organizationmember_teams_new_id_uniq"',
        pk_name
    );
END $$;

-- Rotate all three so the running release keeps both columns it declares.
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "id" TO "id_tmp";
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "id_tmp" TO "new_id";
"""

# Builds both indexes inside the lock, so this is not O(1) and would cross production's 10s
# statement timeout at scale. For tests and local work, not a production rollback plan.
# Fails if the sequence has passed 2^31, since the narrow column could not hold it.
UNSWAP_SQL = """
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "new_id" TO "id_tmp";
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "id" TO "new_id";
ALTER TABLE "sentry_organizationmember_teams" RENAME COLUMN "id_tmp" TO "id";

ALTER TABLE "sentry_organizationmember_teams" ALTER COLUMN "new_id" DROP DEFAULT;
ALTER SEQUENCE "sentry_organizationmember_teams_id_seq" AS integer;
ALTER SEQUENCE "sentry_organizationmember_teams_id_seq"
    OWNED BY "sentry_organizationmember_teams"."id";
ALTER TABLE "sentry_organizationmember_teams"
    ALTER COLUMN "id" SET DEFAULT nextval('sentry_organizationmember_teams_id_seq');

DO $$
DECLARE
    pk_name text;
BEGIN
    SELECT constraint_name INTO pk_name
    FROM information_schema.table_constraints
    WHERE table_schema = current_schema()
      AND table_name = 'sentry_organizationmember_teams'
      AND constraint_type = 'PRIMARY KEY';

    EXECUTE format(
        'ALTER TABLE "sentry_organizationmember_teams" DROP CONSTRAINT %I', pk_name
    );

    CREATE UNIQUE INDEX "sentry_organizationmember_teams_new_id_uniq"
        ON "sentry_organizationmember_teams" ("new_id");

    EXECUTE format(
        'ALTER TABLE "sentry_organizationmember_teams" ADD CONSTRAINT %I PRIMARY KEY ("id")',
        pk_name
    );
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
    # opposite: a short metadata-only rotation that leaves the table without a primary key if
    # it stops partway.
    atomic = True

    dependencies = [
        ("sentry", "1159_organizationmemberteam_new_id_unique_not_null"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                SafeRunSQL(
                    SWAP_SQL,
                    reverse_sql=UNSWAP_SQL,
                    hints={"tables": ["sentry_organizationmember_teams"]},
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="organizationmemberteam",
                    name="id",
                    field=sentry.db.models.fields.bounded.BoundedBigAutoField(
                        primary_key=True, serialize=False
                    ),
                ),
                migrations.AlterField(
                    model_name="organizationmemberteam",
                    name="new_id",
                    field=sentry.db.models.fields.bounded.BoundedIntegerField(),
                ),
            ],
        ),
    ]
