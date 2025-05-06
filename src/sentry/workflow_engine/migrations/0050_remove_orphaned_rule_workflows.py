import logging
from typing import Any

from django.apps.registry import Apps
from django.db import migrations, router, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.models import Exists, OuterRef

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


def remove_orphaned_rule_workflows(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Rule = apps.get_model("sentry", "Rule")
    AlertRuleWorkflow = apps.get_model("workflow_engine", "AlertRuleWorkflow")
    DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    Action = apps.get_model("workflow_engine", "Action")

    def _delete_workflow(workflow: Any) -> bool:
        action_filters = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )

        actions = Action.objects.filter(
            dataconditiongroupaction__condition_group__in=action_filters
        )

        # Delete the actions associated with a workflow, this is not a cascade delete
        # because we want to create a UI to maintain notification actions separately
        if actions:
            actions.delete()

        if action_filters:
            action_filters.delete()

        if workflow.when_condition_group:
            workflow.when_condition_group.delete()

        workflow.delete()

        return True

    orphaned_rule_workflow = AlertRuleWorkflow.objects.filter(
        ~Exists(Rule.objects.filter(id=OuterRef("rule_id"))),
        rule_id__isnull=False,
    )

    for rule_workflow in RangeQuerySetWrapper(orphaned_rule_workflow):
        with transaction.atomic(router.db_for_write(Workflow)):
            workflow = Workflow.objects.select_for_update().get(id=rule_workflow.workflow_id)
            _delete_workflow(workflow)
            rule_workflow.delete()
            logger.info(
                "workflow_engine.orphaned_rule_workflow.deleted", extra={"workflow_id": workflow.id}
            )


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
        ("workflow_engine", "0049_migrate_metric_alerts"),
    ]

    operations = [
        migrations.RunPython(
            remove_orphaned_rule_workflows,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_rule", "workflow_engine_workflow"]},
        ),
    ]
