from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class Action(DefaultFieldsModel):
    """
    Actions are actions that can be taken if the conditions of a DataConditionGroup are satisfied.
    Examples include: detectors emitting events, sending notifications, creating an issue in the Issue Platform, etc.
    """

    __relocation_scope__ = RelocationScope.Excluded
    __repr__ = sane_repr("workflow_id", "type")

    # TODO (@saponifi3d): Don't hardcode these values
    class Type(models.TextChoices):
        Notification = "SendNotificationAction"
        TriggerWorkflow = "TriggerWorkflowAction"

    """
    Required actions cannot be disabled by the user, and will not be displayed in the UI.
    These actions will be used internally, to trigger other aspects of the system.
    For example, creating a new issue in the Issue Platform or a detector emitting an event.
    """
    required = models.BooleanField(default=False)

    type = models.TextField(choices=Type.choices)
    data = models.JSONField(default=dict)
