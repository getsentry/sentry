from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration


DEFAULT_WORKFLOW_NAME = "Seer automation"
SEER_INVESTIGATION_WORKFLOW_TYPE = "seer_investigation"


def convert_seer_workflow_actions(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Action = apps.get_model("workflow_engine", "Action")
    SeerWorkflowTriggerBinding = apps.get_model("seer", "SeerWorkflowTriggerBinding")
    # Action.type isn't indexed, so find the actions through their bindings rather than scanning
    # the whole table. Every seer_workflow action was created with a binding.
    action_ids = SeerWorkflowTriggerBinding.objects.values_list("trigger_action_id", flat=True)
    Action.objects.filter(id__in=list(action_ids), type="seer_workflow").update(
        type="seer_investigation"
    )


def update_backing_workflows(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    for config in SeerWorkflowConfig.objects.filter(backing_workflow__isnull=False):
        workflow = Workflow.objects.get(id=config.backing_workflow_id)
        name = config.extras.get("name")
        created_by = config.extras.get("created_by")
        if name and workflow.name == DEFAULT_WORKFLOW_NAME:
            workflow.name = name
        if isinstance(created_by, int) and workflow.created_by_id is None:
            workflow.created_by_id = created_by
        workflow.type = SEER_INVESTIGATION_WORKFLOW_TYPE
        workflow.save(update_fields=["name", "created_by_id", "type"])


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

    # Post deployment so it also converts actions that pods still running the old code create.
    # Only a handful of automations exist, so the per-row loop below is fine.
    is_post_deployment = True

    dependencies = [
        ("seer", "0046_add_workflow_config_backing_workflow"),
        ("workflow_engine", "0126_workflowfirehistory_nullable_group"),
    ]

    operations = [
        migrations.RunPython(
            convert_seer_workflow_actions,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["seer_workflowtriggerbinding", "workflow_engine_action"]},
        ),
        migrations.RunPython(
            update_backing_workflows,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["seer_workflowconfig", "workflow_engine_workflow"]},
        ),
    ]
