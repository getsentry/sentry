from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class Action(DefaultFieldsModel):
    """
    Actions are actions that can be taken if the conditions of a DataConditionGrou are satisfied.
    Examples include: detectors emitting events, sending notifications, creating an issue in the Issue Platform, etc.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("workflow_id", "type")

    # TODO (@saponifi3d): Don't hardcode these values
    class Type(models.TextChoices):
        Notification = "SendNotificationAction"
        TriggerWorkflow = "TriggerWorkflowAction"

    required = models.BooleanField(default=False)
    type = models.TextField(choices=Type.choices)
    data = models.JSONField(default=dict)
