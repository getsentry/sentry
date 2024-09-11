from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr

# TODO - evaluate the AlertRuleActivityAction model to see if we can use it as the base abstraction here


@region_silo_model
class WorkflowAction(DefaultFieldsModel):
    """
    A workflow action is an action to be taken as part of a workflow.
    These will be executed in order as part of a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization
    workflow = FlexibleForeignKey("sentry.workflow_engine.Workflow")
    type = models.CharField(max_length=64)

    __repr__ = sane_repr("workflow_id", "action_type")

    class Meta:
        app_label = "sentry.workflow_engine"
        db_table = "workflow_engine_workflowaction"

        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "action_type"], name="unique_workflow_action_per_workflow"
            )
        ]
