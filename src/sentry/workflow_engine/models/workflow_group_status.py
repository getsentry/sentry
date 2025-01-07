from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class WorkflowGroupStatus(DefaultFieldsModel):
    """
    Stores when a workflow last fired for a Group.
    """

    ACTIVE = 0
    INACTIVE = 1

    __relocation_scope__ = RelocationScope.Organization

    workflow = FlexibleForeignKey("workflow_engine.Workflow", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group")
    status = models.PositiveSmallIntegerField(default=ACTIVE)
    date_added = models.DateTimeField(default=timezone.now)
    last_active = models.DateTimeField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "group"],
                name="workflow_engine_uniq_workflow_group",
            )
        ]
