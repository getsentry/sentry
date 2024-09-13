from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr


@region_silo_model
class WorkflowAction(DefaultFieldsModel):
    """
    A workflow action is an action to be taken as part of a workflow.
    These will be executed in order as part of a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization

    class Type(models.TextChoices):
        NOTIFICATION = "SendNotificationAction"

    required = models.BooleanField(default=False)
    workflow = FlexibleForeignKey("workflow_engine.Workflow")
    type = models.TextField(choices=Type.choices)
    data = models.JSONField(default=dict)

    __repr__ = sane_repr("workflow_id", "type")
