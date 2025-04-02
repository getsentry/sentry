from abc import abstractmethod
from typing import Any, Generic, TypeVar

from jsonschema import ValidationError as JsonValidationError
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models.data_condition import CONDITION_OPS, Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

ComparisonType = TypeVar("ComparisonType")
ConditionResult = TypeVar("ConditionResult")


class BaseDataConditionValidator(
    CamelSnakeSerializer,
    Generic[ComparisonType, ConditionResult],
):
    type = serializers.ChoiceField(choices=[(t.value, t.value) for t in Condition])
    comparison = serializers.JSONField(required=True)
    condition_result = serializers.JSONField(required=True)
    condition_group_id = serializers.IntegerField()

    def _get_handler(self) -> DataConditionHandler | None:
        condition_type = self.initial_data.get("type")
        if condition_type in CONDITION_OPS:
            return None

        try:
            return condition_handler_registry.get(condition_type)
        except NoRegistrationExistsError:
            raise serializers.ValidationError(f"Invalid condition type: {condition_type}")

    def validate_comparison(self, value: Any) -> ComparisonType:
        handler = self._get_handler()
        if not handler:
            raise serializers.ValidationError("Invalid JSON Schema for comparison")

        try:
            return validate_json_schema(value, handler.comparison_json_schema)
        except JsonValidationError:
            raise serializers.ValidationError("Invalid JSON Schema for comparison")

    @abstractmethod
    def validate_condition_result(self, value: Any) -> ConditionResult:
        pass
