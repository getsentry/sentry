from abc import abstractmethod
from typing import Any, Generic, TypeVar

from jsonschema import ValidationError as JsonValidationError
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.endpoints.validators.utils import (
    validate_json_primitive,
    validate_json_schema,
)
from sentry.workflow_engine.models.data_condition import CONDITION_OPS, Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

ComparisonType = TypeVar("ComparisonType")
ConditionResult = TypeVar("ConditionResult")


class AbstractDataConditionValidator(
    CamelSnakeSerializer,
    Generic[ComparisonType, ConditionResult],
):
    id = serializers.IntegerField(required=False)
    type = serializers.ChoiceField(choices=[(t.value, t.value) for t in Condition])
    comparison = serializers.JSONField(required=True)
    condition_result = serializers.JSONField(required=True)
    condition_group_id = serializers.IntegerField(required=True)

    @abstractmethod
    def validate_comparison(self, value: Any) -> ComparisonType:
        pass

    @abstractmethod
    def validate_condition_result(self, value: Any) -> ConditionResult:
        pass


class BaseDataConditionValidator(
    AbstractDataConditionValidator[Any, Any],
):
    def _get_handler(self) -> DataConditionHandler | None:
        if self._is_operator_condition():
            return None

        condition_type = self.initial_data.get("type")

        try:
            return condition_handler_registry.get(condition_type)
        except NoRegistrationExistsError:
            raise serializers.ValidationError(f"Invalid condition type: {condition_type}")

    def _is_operator_condition(self) -> bool:
        condition_type = self.initial_data.get("type")
        return condition_type in CONDITION_OPS

    def validate_comparison(self, value: Any) -> Any:
        """
        Validate the comparison field. Get the schema configuration for the type, if
        there is no schema configuration, then we assume the comparison field is a primitive value.
        """

        handler = self._get_handler()

        if not handler:
            if self._is_operator_condition():
                return validate_json_primitive(value)
            else:
                raise serializers.ValidationError("Invalid comparison value for condition type")

        try:
            return validate_json_schema(value, handler.comparison_json_schema)
        except JsonValidationError:
            raise serializers.ValidationError(
                f"Value, {value} does not match JSON Schema for comparison"
            )

    def validate_condition_result(self, value: Any) -> Any:
        """
        Validate the condition_result field.

        Gets the schema for this type of DataCondition, if there is no schema for that type,
        then we assume the condition_result field is a primitive value.
        """
        handler = self._get_handler()

        if not handler:
            if self._is_operator_condition():
                return validate_json_primitive(value)
            else:
                raise serializers.ValidationError(
                    "Invalid condition result value for condition type"
                )

        try:
            return validate_json_schema(value, handler.condition_result_schema)
        except JsonValidationError:
            raise serializers.ValidationError(
                f"Value, {value}, does not match JSON Schema for condition result"
            )
