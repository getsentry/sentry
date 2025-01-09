from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class ActionGroupStatus(DefaultFieldsModel):
    """
    Stores when an action last fired for a Group.
    """

    __relocation_scope__ = RelocationScope.Excluded

    action = FlexibleForeignKey("workflow_engine.Action", on_delete=models.CASCADE)
    group = FlexibleForeignKey("sentry.Group")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["action", "group"],
                name="workflow_engine_uniq_action_group",
            )
        ]
