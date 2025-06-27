from django.db.models import Index

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model


@region_silo_model
class DataConditionGroupAction(DefaultFieldsModel):
    """
    A model that represents the relationship between a data condition group and an action.
    """

    __relocation_scope__ = RelocationScope.Excluded

    condition_group = FlexibleForeignKey("workflow_engine.DataConditionGroup")
    action = FlexibleForeignKey("workflow_engine.Action")

    class Meta:
        indexes = [
            Index(fields=["condition_group", "action"], name="cond_group_action_idx"),
        ]
