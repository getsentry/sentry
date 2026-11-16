import django.db.models.deletion
from django.db import migrations

import sentry.db.models.fields.foreignkey
from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

CHECK = "sentry_monitorcheckin_checkin_config_id_17e2de71_notnull"


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

    # Validating the NOT NULL check scans the whole check-in table.
    is_post_deployment = True

    dependencies = [
        ("monitors", "0026_drop_checkin_config_index"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # AlterField would also drop and re-validate the FK constraint, a second full scan.
            database_operations=[
                SafeRunSQL(
                    [
                        # Clears a check left behind by a killed run.
                        f'ALTER TABLE "sentry_monitorcheckin" DROP CONSTRAINT IF EXISTS "{CHECK}"',
                        f'ALTER TABLE "sentry_monitorcheckin" ADD CONSTRAINT "{CHECK}" '
                        'CHECK ("checkin_config_id" IS NOT NULL) NOT VALID',
                    ],
                    reverse_sql=(
                        f'ALTER TABLE "sentry_monitorcheckin" DROP CONSTRAINT IF EXISTS "{CHECK}"'
                    ),
                    hints={"tables": ["sentry_monitorcheckin"]},
                ),
                SafeRunSQL(
                    f'ALTER TABLE "sentry_monitorcheckin" VALIDATE CONSTRAINT "{CHECK}"',
                    reverse_sql=migrations.RunSQL.noop,
                    hints={"tables": ["sentry_monitorcheckin"]},
                    # Scans the whole table, so it can't fit in the statement timeout.
                    use_statement_timeout=False,
                ),
                SafeRunSQL(
                    [
                        'ALTER TABLE "sentry_monitorcheckin" '
                        'ALTER COLUMN "checkin_config_id" SET NOT NULL',
                        f'ALTER TABLE "sentry_monitorcheckin" DROP CONSTRAINT "{CHECK}"',
                    ],
                    reverse_sql=(
                        'ALTER TABLE "sentry_monitorcheckin" '
                        'ALTER COLUMN "checkin_config_id" DROP NOT NULL'
                    ),
                    hints={"tables": ["sentry_monitorcheckin"]},
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="monitorcheckin",
                    name="checkin_config",
                    field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_index=False,
                        on_delete=django.db.models.deletion.PROTECT,
                        to="monitors.monitorcheckinconfig",
                    ),
                ),
            ],
        ),
    ]
