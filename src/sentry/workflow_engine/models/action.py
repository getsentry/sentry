from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class Action(DefaultFieldsModel):
    """
    A workflow action is an action to be taken as part of a workflow.
    These will be executed in order as part of a workflow.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("workflow_id", "type")

    # TODO (@saponifi3d): Don't hardcode these values
    class Type(models.TextChoices):
        Notification = "SendNotificationAction"

    required = models.BooleanField(default=False)
    type = models.TextField(choices=Type.choices)
    data = models.JSONField(default=dict)
    data_condition_group = models.ForeignKey(
        "workflow_engine.DataConditionGroup", on_delete=models.CASCADE, blank=True, null=True
    )
