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


def move_high_priority_conditions_to_triggers(
    apps: Apps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    Rule = apps.get_model("sentry", "Rule")
    DataCondition = apps.get_model("workflow_engine", "DataCondition")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    WorkflowDataConditionGroup = apps.get_model("workflow_engine", "WorkflowDataConditionGroup")

    backfill_key = "workflow_engine_fix_high_priority_conditions"
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    progress_id = int(redis_client.get(backfill_key) or 0)

    for workflows in chunked(
        RangeQuerySetWrapperWithProgressBarApprox(
            Workflow.objects.filter(id__gt=progress_id), step=CHUNK_SIZE
        ),
        CHUNK_SIZE,
    ):
        for workflow in workflows:
            with transaction.atomic(router.db_for_write(Rule)):
                current_workflow = (
                    Workflow.objects.select_for_update().filter(id=workflow.id).first()
                )

                if not current_workflow:
                    continue

                when_condition_group_id = current_workflow.when_condition_group_id
                workflow_dcg = WorkflowDataConditionGroup.objects.filter(
                    workflow_id=workflow.id
                ).first()

                if not when_condition_group_id or not workflow_dcg:
                    logger.info(
                        "Missing when or if condition group",
                        extra={
                            "workflow_id": workflow.id,
                            "when_condition_group_id": when_condition_group_id,
                            "workflow_dcg": workflow_dcg,
                        },
                    )
                    continue

                if_condition_group_id = workflow_dcg.condition_group_id

                high_priority_conditions = DataCondition.objects.filter(
                    type__in=("existing_high_priority_issue", "new_high_priority_issue"),
                    condition_group_id__in=(when_condition_group_id, if_condition_group_id),
                )

                if not high_priority_conditions:
                    continue

                for condition in high_priority_conditions:
                    condition.condition_group_id = when_condition_group_id
                    condition.save()

                logger.info(
                    "Moved high priority conditions to when condition group",
                    extra={
                        "workflow_id": workflow.id,
                        "condition_ids": [condition.id for condition in high_priority_conditions],
                    },
                )

        redis_client.set(backfill_key, workflows[-1].id, ex=60 * 60 * 24 * 7)


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
        ("workflow_engine", "0058_add_inc_identifier_incidentgroupopenperiod"),
    ]

    operations = [
        migrations.RunPython(
            move_high_priority_conditions_to_triggers,
            migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_workflow", "workflow_engine_datacondition"]},
        ),
    ]
