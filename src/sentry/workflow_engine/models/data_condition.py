import operator
from collections.abc import Callable
from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.utils.registry import NoRegistrationExistsError, Registry

from .data_condition_group import DataConditionGroup


class DataConditionType(models.TextChoices):
    EQ = "eq", "Equals"
    NE = "ne", "Not Equals"
    GT = "gt", "Greater Than"
    GTE = "gte", "Greater Than or Equals"
    LT = "lt", "Less Than"
    LTE = "lte", "Less Than or Equals"


condition_registry = Registry[Callable[[Any, Any], bool]]()

condition_registry.register(DataConditionType.EQ, operator.eq)
condition_registry.register(DataConditionType.NE, operator.ne)
condition_registry.register(DataConditionType.GT, operator.gt)
condition_registry.register(DataConditionType.GTE, operator.ge)
condition_registry.register(DataConditionType.LT, operator.lt)
condition_registry.register(DataConditionType.LTE, operator.le)


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a logic condition, if the condition is met, the condition_result is returned.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "condition")

    # The condition is the logic condition that needs to be met, gt, lt, eq, etc.
    condition = models.CharField(max_length=200, choices=DataConditionType)

    # The comparison is the value that the condition is compared to for the evaluation, this must be a primitive value
    comparison = models.JSONField()

    # The condition_result is the value that is returned if the condition is met, this must be a primitive value
    condition_result = models.JSONField()

    # The type of condition, this is used to initialize the condition classes
    type = models.CharField(max_length=200)

    condition_group = models.ForeignKey(
        DataConditionGroup,
        related_name="conditions",
        on_delete=models.CASCADE,
    )

    def evaluate(self, value):
        """
        Evaluate the condition with the given value
        """
        try:
            operator = condition_registry.get(self.condition)
        except NoRegistrationExistsError:
            raise NotImplementedError(f"Condition {self.condition} is not implemented")

        # TODO - Figure out the JSON in / out for this
        if operator(value, self.comparison):
            return self.condition_result
