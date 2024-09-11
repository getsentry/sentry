from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr


@region_silo_model
class WorkflowAction(DefaultFieldsModel):
    """
    A workflow action is an action to be taken as part of a workflow.
    These will be executed in order as part of a workflow.
    """

    # TODO - Should this live here or should we just define it as the model name?
    class Type(models.TextChoices):
        NOTIFICATION = "SendNotificationAction"

    __relocation_scope__ = RelocationScope.Organization
    workflow = FlexibleForeignKey("workflow_engine.Workflow")
    type = models.TextField(choices=Type.choices)

    # TODO - Invesigate alert rule trigger actions
    # action = models.TextField()

    __repr__ = sane_repr("workflow_id", "type")

    class Meta:
        app_label = "sentry.workflow_engine"
        db_table = "workflow_engine_workflowaction"
