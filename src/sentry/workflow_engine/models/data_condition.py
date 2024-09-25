from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr

from .data_condition_group import DataConditionGroup


def validate_primitive_value(value):
    if not isinstance(value, (bool, int, float, str)):
        raise ValueError("This value must be a primitive type.")


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a logic condition, if the condition is met, the condition_result is returned.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "condition")

    # The condition is the logic condition that needs to be met, gt, lt, eq, etc.
    condition = models.CharField(max_length=200)

    # The threshold is the value that the condition is compared to for numeric expressions
    threshold = models.FloatField(blank=True, null=True)

    # The comparison is the value that the condition is compared to for string expressions
    comparison = models.CharField(max_length=200, blank=True, null=True)

    # The condition_result is the value that is returned if the condition is met, this must be a primitive value
    condition_result = models.JSONField(validators=[validate_primitive_value])

    # The type of condition, this is used to initialize the condition classes
    type = models.CharField(max_length=200)

    condition_group = models.ForeignKey(
        DataConditionGroup,
        on_delete=models.CASCADE,
    )
