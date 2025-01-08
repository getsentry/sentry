from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class ActionGroupStatus(DefaultFieldsModel):
    """
    Stores when a workflow last fired for a Group.
    """

    ACTIVE = 0
    INACTIVE = 1

    __relocation_scope__ = RelocationScope.Organization

    action = FlexibleForeignKey("workflow_engine.Action", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group")
    status = models.PositiveSmallIntegerField(default=ACTIVE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["action", "group"],
                name="workflow_engine_uniq_action_group",
            )
        ]
