import logging

from django.apps.registry import Apps
from django.conf import settings
from django.db import migrations, router, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils import redis
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000


def rename_azure_devops_action_to_vsts(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Action = apps.get_model("workflow_engine", "Action")

    backfill_key = "workflow_engine_rename_azure_devops_action_to_vsts"
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    progress_id = int(redis_client.get(backfill_key) or 0)

    for actions in chunked(
        RangeQuerySetWrapperWithProgressBarApprox(
            Action.objects.filter(id__gt=progress_id, type="azure_devops"), step=CHUNK_SIZE
        ),
        CHUNK_SIZE,
    ):
        for action in actions:
            with transaction.atomic(router.db_for_write(Action)):
                action.type = "vsts"
                action.save()

                logger.info(
                    "Renamed azure_devops action to vsts",
                    extra={
                        "action_id": action.id,
                    },
                )

        redis_client.set(backfill_key, actions[-1].id, ex=60 * 60 * 24 * 7)


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
        ("workflow_engine", "0059_fix_high_priority_condition_triggers"),
    ]

    operations = [
        migrations.RunPython(
            rename_azure_devops_action_to_vsts,
            migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_action"]},
        ),
    ]
