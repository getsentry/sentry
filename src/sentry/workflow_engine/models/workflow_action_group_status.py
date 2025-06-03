from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class WorkflowActionGroupStatus(DefaultFieldsModel):
    """
    Stores when a workflow action last fired for a Group.
    """

    __relocation_scope__ = RelocationScope.Excluded

    workflow = FlexibleForeignKey("workflow_engine.Workflow", on_delete=models.CASCADE)
    action = FlexibleForeignKey("workflow_engine.Action", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group", db_constraint=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "action", "group"],
                name="workflow_engine_uniq_workflow_action_group",
            )
        ]
