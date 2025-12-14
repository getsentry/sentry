import logging
import operator
from enum import StrEnum
from typing import Any, TypedDict, TypeVar, cast

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError, validate

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.utils import metrics, registry
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import ConditionError, DataConditionResult, DetectorPriorityLevel
from sentry.workflow_engine.utils import scopedstats

logger = logging.getLogger(__name__)


class DataConditionEvaluationException(Exception):
    pass


class Condition(StrEnum):
    # Base conditions - Most DETECTOR_TRIGGERS will use these
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_EQUAL = "ne"

    # Anomaly detection
    ANOMALY_DETECTION = "anomaly_detection"

    # Issue conditions
    AGE_COMPARISON = "age_comparison"
    ASSIGNED_TO = "assigned_to"
    EVENT_ATTRIBUTE = "event_attribute"
    EVENT_CREATED_BY_DETECTOR = "event_created_by_detector"
    EVENT_SEEN_COUNT = "event_seen_count"
    EXISTING_HIGH_PRIORITY_ISSUE = "existing_high_priority_issue"
    FIRST_SEEN_EVENT = "first_seen_event"
    ISSUE_CATEGORY = "issue_category"
    ISSUE_OCCURRENCES = "issue_occurrences"
    LATEST_ADOPTED_RELEASE = "latest_adopted_release"
    LATEST_RELEASE = "latest_release"
    LEVEL = "level"
    NEW_HIGH_PRIORITY_ISSUE = "new_high_priority_issue"
    REGRESSION_EVENT = "regression_event"
    REAPPEARED_EVENT = "reappeared_event"
    TAGGED_EVENT = "tagged_event"
    ISSUE_PRIORITY_EQUALS = "issue_priority_equals"
    ISSUE_PRIORITY_GREATER_OR_EQUAL = "issue_priority_greater_or_equal"
    ISSUE_PRIORITY_DEESCALATING = "issue_priority_deescalating"
    ISSUE_RESOLUTION_CHANGE = "issue_resolution_change"

    # Event frequency conditions
    EVENT_FREQUENCY_COUNT = "event_frequency_count"
    EVENT_FREQUENCY_PERCENT = "event_frequency_percent"
    EVENT_UNIQUE_USER_FREQUENCY_COUNT = "event_unique_user_frequency_count"
    EVENT_UNIQUE_USER_FREQUENCY_PERCENT = "event_unique_user_frequency_percent"
    PERCENT_SESSIONS_COUNT = "percent_sessions_count"
    PERCENT_SESSIONS_PERCENT = "percent_sessions_percent"

    # Migration Only
    EVERY_EVENT = "every_event"


CONDITION_OPS = {
    Condition.EQUAL: operator.eq,
    Condition.GREATER_OR_EQUAL: operator.ge,
    Condition.GREATER: operator.gt,
    Condition.LESS_OR_EQUAL: operator.le,
    Condition.LESS: operator.lt,
    Condition.NOT_EQUAL: operator.ne,
}

PERCENT_CONDITIONS = [
    Condition.EVENT_FREQUENCY_PERCENT,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    Condition.PERCENT_SESSIONS_PERCENT,
]

SLOW_CONDITIONS = [
    Condition.EVENT_FREQUENCY_COUNT,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    Condition.PERCENT_SESSIONS_COUNT,
] + PERCENT_CONDITIONS

# Conditions that are not supported in the UI
LEGACY_CONDITIONS = [
    Condition.EVENT_CREATED_BY_DETECTOR,
    Condition.EVENT_SEEN_COUNT,
    Condition.NEW_HIGH_PRIORITY_ISSUE,
    Condition.EXISTING_HIGH_PRIORITY_ISSUE,
    Condition.ISSUE_RESOLUTION_CHANGE,
    Condition.ISSUE_PRIORITY_EQUALS,
]


T = TypeVar("T")


class DataConditionSnapshot(TypedDict):
    id: int
    type: str
    comparison: str
    condition_result: DataConditionResult


@region_silo_model
class DataCondition(DefaultFieldsModel):
    """
    A data condition is a way to specify a logic condition, if the condition is met, the condition_result is returned.
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("type", "comparison", "condition_result", "condition_group_id")

    # The comparison is the value that the condition is compared to for the evaluation, this must be a primitive value
    comparison = models.JSONField()

    # The condition_result is the value that is returned if the condition is met, this must be a primitive value
    condition_result = models.JSONField()

    # The type of condition, this is used to initialize the condition classes
    type = models.CharField(
        max_length=200, choices=[(t.value, t.value) for t in Condition], default=Condition.EQUAL
    )

    condition_group = models.ForeignKey(
        "workflow_engine.DataConditionGroup",
        related_name="conditions",
        on_delete=models.CASCADE,
    )

    def get_snapshot(self) -> DataConditionSnapshot:
        return {
            "id": self.id,
            "type": self.type,
            "comparison": self.comparison,
            "condition_result": self.condition_result,
        }

    def get_condition_result(self) -> DataConditionResult | ConditionError:
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
                return ConditionError(msg="Invalid condition result")

    def _evaluate_operator(
        self, condition_type: Condition, value: T
    ) -> DataConditionResult | ConditionError:
        # If the condition is a base type, handle it directly
        op = CONDITION_OPS[condition_type]
        try:
            return op(cast(Any, value), self.comparison)
        except TypeError:
            logger.exception(
                "Invalid comparison for data condition",
                extra={
                    "comparison": self.comparison,
                    "value": value,
                    "type": self.type,
                    "condition_id": self.id,
                },
            )
            return ConditionError(msg="Invalid comparison for data condition")

    @scopedstats.timer()
    def _evaluate_condition(
        self, condition_type: Condition, value: T
    ) -> DataConditionResult | ConditionError:
        try:
            handler = condition_handler_registry.get(condition_type)
        except registry.NoRegistrationExistsError:
            logger.exception(
                "No registration exists for condition",
                extra={"type": self.type, "id": self.id},
            )
            return ConditionError(msg="No registration exists for condition")

        should_be_fast = not is_slow_condition(self)
        try:
            with metrics.timer(
                "workflow_engine.data_condition.evaluation_duration",
                tags={"type": self.type, "speed_category": "fast" if should_be_fast else "slow"},
            ):
                result = handler.evaluate_value(value, self.comparison)
        except DataConditionEvaluationException as e:
            metrics.incr("workflow_engine.data_condition.evaluation_error")
            logger.info(
                "A known error occurred while evaluating a data condition",
                extra={
                    "condition_id": self.id,
                    "type": self.type,
                    "comparison": self.comparison,
                    "value": value,
                    "error": str(e),
                },
            )
            return ConditionError(msg=str(e))

        return result

    def evaluate_value(self, value: T) -> DataConditionResult | ConditionError:
        try:
            condition_type = Condition(self.type)
        except ValueError:
            logger.exception(
                "Invalid condition type",
                extra={"type": self.type, "id": self.id},
            )
            return ConditionError(msg="Invalid condition type")

        result: DataConditionResult | ConditionError
        if condition_type in CONDITION_OPS:
            result = self._evaluate_operator(condition_type, value)
        else:
            result = self._evaluate_condition(condition_type, value)

        metrics.incr("workflow_engine.data_condition.evaluation", tags={"type": self.type})

        if isinstance(result, bool):
            # If the result is True, get the result from `.condition_result`
            return self.get_condition_result() if result else None

        return result


def is_slow_condition(condition: DataCondition) -> bool:
    return Condition(condition.type) in SLOW_CONDITIONS


def enforce_data_condition_json_schema(data_condition: DataCondition) -> None:
    condition_type = Condition(data_condition.type)
    if condition_type in CONDITION_OPS:
        # don't enforce schema for default ops, this can be any type
        return

    try:
        handler = condition_handler_registry.get(condition_type)
    except registry.NoRegistrationExistsError:
        logger.exception(
            "No registration exists for condition",
            extra={"type": data_condition.type, "id": data_condition.id},
        )
        return None

    schema = handler.comparison_json_schema

    try:
        validate(data_condition.comparison, schema)
    except ValidationError as e:
        raise ValidationError(f"Invalid config: {e.message}")


@receiver(pre_save, sender=DataCondition)
def enforce_comparison_schema(sender, instance: DataCondition, **kwargs):
    enforce_data_condition_json_schema(instance)
