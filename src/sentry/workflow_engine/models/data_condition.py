import logging
import operator
from typing import Any, TypeVar

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import (
    DataConditionHandler,
    DataConditionResult,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)


class Condition(models.TextChoices):
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_EQUAL = "ne"
    GROUP_EVENT_ATTR_COMPARISON = "group_event_attr_comparison"


condition_ops = {
    Condition.EQUAL: operator.eq,
    Condition.GREATER_OR_EQUAL: operator.ge,
    Condition.GREATER: operator.gt,
    Condition.LESS_OR_EQUAL: operator.le,
    Condition.LESS: operator.lt,
    Condition.NOT_EQUAL: operator.ne,
}

T = TypeVar("T")


def get_nested_value(data: Any, path: str, default: Any = None) -> Any:
    try:
        value = data
        for part in path.split("."):
            if hasattr(value, part):
                value = getattr(value, part)
            elif hasattr(value, "get"):
                value = value.get(part)
            else:
                return default
        return value
    except Exception:
        return default


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a logic condition, if the condition is met, the condition_result is returned.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "comparison_value", "condition_group")

    # TODO - finish removing this field
    condition = models.CharField(max_length=200, null=True)

    # The comparison is the value that the condition is compared to for the evaluation, this must be a primitive value
    comparison_value = models.JSONField(db_column="comparison")

    # The condition_result is the value that is returned if the condition is met, this must be a primitive value
    condition_result = models.JSONField()

    # The type of condition, this is used to initialize the condition classes
    type = models.CharField(max_length=200, choices=Condition.choices)

    condition_group = models.ForeignKey(
        "workflow_engine.DataConditionGroup",
        related_name="conditions",
        on_delete=models.CASCADE,
    )

    # input_data_filters can be used to get data out of dictionaries or classes
    input_data_filter = models.CharField(max_length=200, null=True)

    def get_condition_result(self) -> DataConditionResult:
        match self.condition_result:
            case float() | bool():
                return self.condition_result
            case int() | DetectorPriorityLevel():
                try:
                    return DetectorPriorityLevel(self.condition_result)
                except ValueError:
                    return self.condition_result
            case _:
                logger.error(
                    "Invalid condition result",
                    extra={"condition_result": self.condition_result, "id": self.id},
                )

        return None

    def get_condition_handler(self) -> DataConditionHandler[T] | None:
        try:
            condition_type = Condition(self.type)
        except ValueError:
            # If the type isn't in the condition, then it won't be in the registry either.
            raise NoRegistrationExistsError(f"No registration exists for {self.type}")

        return condition_handler_registry.get(condition_type)

    def evaluate_value(self, value: T) -> DataConditionResult:
        handler: DataConditionHandler[T] | None = None

        try:
            handler = self.get_condition_handler()
        except NoRegistrationExistsError:
            logger.exception(
                "No registration exists for DataCondition",
                extra={"condition": self.type, "id": self.id},
            )
            return None

        evaluation_value = value
        if self.input_data_filter:
            # If there's a filter on the value, then we need to extract the nested value.
            evaluation_value = get_nested_value(value, self.input_data_filter)

        if handler is not None:
            result = handler.evaluate_value(evaluation_value, self.comparison_value)

        if result:
            return self.get_condition_result()

        return None
