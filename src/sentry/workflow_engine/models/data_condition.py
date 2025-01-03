import logging
import operator
from typing import Any, TypeVar, cast

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionResult, DetectorPriorityLevel

logger = logging.getLogger(__name__)


class Condition(models.TextChoices):
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_EQUAL = "ne"
    EVENT_ATTRIBUTE = "event_attribute"
    EVENT_CREATED_BY_DETECTOR = "event_created_by_detector"
    EVENT_SEEN_COUNT = "event_seen_count"
    EVERY_EVENT = "every_event"
    EXISTING_HIGH_PRIORITY_ISSUE = "existing_high_priority_issue"
    FIRST_SEEN_EVENT = "first_seen_event"
    LEVEL = "level"
    NEW_HIGH_PRIORITY_ISSUE = "new_high_priority_issue"
    REGRESSION_EVENT = "regression_event"
    REAPPEARED_EVENT = "reappeared_event"
    TAGGED_EVENT = "tagged_event"


condition_ops = {
    Condition.EQUAL: operator.eq,
    Condition.GREATER_OR_EQUAL: operator.ge,
    Condition.GREATER: operator.gt,
    Condition.LESS_OR_EQUAL: operator.le,
    Condition.LESS: operator.lt,
    Condition.NOT_EQUAL: operator.ne,
}

T = TypeVar("T")


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a logic condition, if the condition is met, the condition_result is returned.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "condition", "condition_group")

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

    def evaluate_value(self, value: T) -> DataConditionResult:
        try:
            condition_type = Condition(self.type)
        except ValueError:
            logger.exception(
                "Invalid condition type",
                extra={"type": self.type, "id": self.id},
            )
            return None

        if condition_type in condition_ops:
            # If the condition is a base type, handle it directly
            op = condition_ops[Condition(self.type)]
            result = op(cast(Any, value), self.comparison)
            return self.get_condition_result() if result else None

        # Otherwise, we need to get the handler and evaluate the value
        try:
            handler = condition_handler_registry.get(condition_type)
        except NoRegistrationExistsError:
            logger.exception(
                "No registration exists for condition",
                extra={"type": self.type, "id": self.id},
            )
            return None

        result = handler.evaluate_value(value, self.comparison)
        return self.get_condition_result() if result else None
