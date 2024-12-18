import logging
import operator
from typing import Any, TypeVar, cast

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


def get_nested_value(data: Any, path: str, default: Any = None) -> Any | None:
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
    __repr__ = sane_repr("type", "condition", "condition_group")

    # TODO finish removing this field, it was too confusing - changing to null first to allow us to decouple the code
    condition = models.CharField(max_length=200, null=True)

    # The comparison is the value that the condition is compared to for the evaluation, this must be a primitive value
    comparison = models.JSONField()

    # The condition_result is the value that is returned if the condition is met, this must be a primitive value
    condition_result = models.JSONField()

    # The type of condition, this is used to initialize the condition classes
    type = models.CharField(max_length=200, choices=Condition.choices, default=Condition.EQUAL)

    condition_group = models.ForeignKey(
        "workflow_engine.DataConditionGroup",
        related_name="conditions",
        on_delete=models.CASCADE,
    )

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

    def get_handler(self) -> DataConditionHandler[T]:
        try:
            condition_type = Condition(self.type)
        except ValueError:
            # If the type isn't in the condition, then it won't be in the registry either.
            raise NoRegistrationExistsError(f"No registration exists for {self.type}")

        return condition_handler_registry.get(condition_type)

    def evaluate_value(self, value: T) -> DataConditionResult:
        try:
            handler: DataConditionHandler[T] = self.get_handler()
        except NoRegistrationExistsError:
            logger.exception(
                "Invalid Data Condition Evaluation",
                extra={
                    "id": self.id,
                    "type": self.type,
                    "condition": self.condition,
                },
            )

        filtered_value = value
        if self.input_data_filter:
            # casting to any is a bit of a hack here, we lose type safety by doing this :thinking:
            # we might be able to use `self.input_data_filter` to branch the logic on evaluate_value types
            filtered_value = cast(Any, get_nested_value(value, self.input_data_filter))

        result = handler.evaluate_value(filtered_value, self.comparison)

        if result:
            return self.get_condition_result()

        return None
