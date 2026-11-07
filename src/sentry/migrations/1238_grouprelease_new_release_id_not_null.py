import sentry.db.models.fields.bounded
from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL

# Django derives this name as md5(table, column); it must match what AlterField emits.
NOT_NULL_CHECK = "sentry_grouprelease_new_release_id_9a0f50dc_notnull"


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
        ("sentry", "1237_detach_incident_foreign_keys"),
    ]

    operations = [
        # AlterField adds this CHECK then drops it; an interrupted run leaves it to collide.
        SafeRunSQL(
            f'ALTER TABLE "sentry_grouprelease" DROP CONSTRAINT IF EXISTS "{NOT_NULL_CHECK}"',
            reverse_sql=migrations.RunSQL.noop,
            hints={"tables": ["sentry_grouprelease"]},
        ),
        migrations.AlterField(
            model_name="grouprelease",
            name="new_release_id",
            field=sentry.db.models.fields.bounded.BoundedBigIntegerField(),
        ),
    ]
