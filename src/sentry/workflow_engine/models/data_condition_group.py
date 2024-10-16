from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


@region_silo_model
class DataConditionGroup(DefaultFieldsModel):
    """
    A data group is a way to specify a group of conditions that must be met for a workflow action to execute
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("logic_type")

    class Type(models.TextChoices):
        ANY = "any"
        ALL = "all"
        NONE = "none"

    logic_type = models.CharField(max_length=200, choices=Type.choices, default=Type.ANY)
    organization = models.ForeignKey("sentry.Organization", on_delete=models.CASCADE)

    def evaluate_conditions(self, data):
        """
        Evaluate all the conditions in the group
        """
        # get the conditions for the group
        # iterate over the conditions
        #   evaluate each condition
        #   if the logic type is ANY and any condition is True, return condition.condition_result
        #  if the logic type is ALL and all conditions are True, return condition.condition_result
        pass
